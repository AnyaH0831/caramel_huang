// Resilient fetch loader: prefer global fetch (Node 18+), fall back to node-fetch if available.
let fetchLib;
let fetchLoaderError = null;
try {
    if (typeof globalThis.fetch === 'function') {
        fetchLib = globalThis.fetch.bind(globalThis);
    } else {
        fetchLib = require("node-fetch");
    }
} catch (err) {
    // Defer throwing until function invocation so Azure's language worker doesn't crash on module load.
    fetchLib = null;
    // We'll log this inside the function when context is available.
    fetchLoaderError = err;
}

// Blob storage loader for local memory (defer errors until runtime)
let BlobServiceClient = null;
let blobLoaderError = null;
try {
    BlobServiceClient = require('@azure/storage-blob').BlobServiceClient;
} catch (e) {
    BlobServiceClient = null;
    blobLoaderError = e;
}

function extractReplyFromFireworksResponse(data) {
    if (!data || typeof data !== 'object') return '';

    if (data.choices && Array.isArray(data.choices) && data.choices[0]) {
        const choice = data.choices[0];
        if (choice.message && typeof choice.message.content === 'string') {
            return choice.message.content.trim();
        }
        if (typeof choice.text === 'string') {
            return choice.text.trim();
        }
    }

    if (data.output && Array.isArray(data.output) && data.output[0]) {
        const first = data.output[0];
        if (typeof first.content === 'string') {
            return first.content.trim();
        }
        if (Array.isArray(first.content)) {
            const joined = first.content
                .map((part) => (typeof part === 'string' ? part : part && part.text ? part.text : ''))
                .join(' ')
                .trim();
            if (joined) return joined;
        }
    }

    if (data.message && typeof data.message.content === 'string') {
        return data.message.content.trim();
    }

    return '';
}


module.exports = async function (context, req) {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        context.res = {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            }
        };
        return;
    }

    // Set CORS headers for actual requests
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"
    };

    // Quick debug GET endpoint to check env var presence (safe: does NOT return the token)
    if (req.method === "GET") {
        context.res = {
            status: 200,
            headers: corsHeaders,
            body: {
                ok: true,
                FIREWORKS_API_TOKEN_present: !!process.env.FIREWORKS_API_TOKEN
            }
        };
        return;
    }

    // Debug logging
    context.log("Chat function started");
    context.log("Environment FIREWORKS_API_TOKEN:", process.env.FIREWORKS_API_TOKEN ? "Exists" : "Missing");
    context.log("Request body:", req.body);

    // Storage connection string (supports AZURE_STORAGE_CONNECTION_STRING or AzureWebJobsStorage)
    const storageConn = process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || null;
    const memoryContainer = 'chat-memory';

    // helper: convert readable stream to string
    async function streamToString(readable) {
        if (!readable) return '';
        return await new Promise((resolve, reject) => {
            const chunks = [];
            readable.on('data', (data) => chunks.push(data.toString()));
            readable.on('end', () => resolve(chunks.join('')));
            readable.on('error', reject);
        });
    }

    // helper: load session memory from blob storage
    async function loadSessionMemory(sessionId) {
        if (!BlobServiceClient || !storageConn) return [];
        try {
            const blobServiceClient = BlobServiceClient.fromConnectionString(storageConn);
            const containerClient = blobServiceClient.getContainerClient(memoryContainer);
            await containerClient.createIfNotExists();
            const blobClient = containerClient.getBlobClient(`session-${sessionId}.json`);
            const exists = await blobClient.exists();
            if (!exists) return [];
            const download = await blobClient.download();
            const txt = await streamToString(download.readableStreamBody);
            return JSON.parse(txt || '[]');
        } catch (err) {
            context.log.error('Failed loading session memory:', err && err.message);
            return [];
        }
    }

    // helper: save session memory
    async function saveSessionMemory(sessionId, memoryArray) {
        if (!BlobServiceClient || !storageConn) return;
        try {
            const blobServiceClient = BlobServiceClient.fromConnectionString(storageConn);
            const containerClient = blobServiceClient.getContainerClient(memoryContainer);
            await containerClient.createIfNotExists();
            const blobClient = containerClient.getBlockBlobClient(`session-${sessionId}.json`);
            const data = JSON.stringify(memoryArray || []);
            await blobClient.uploadData(Buffer.from(data), { overwrite: true });
        } catch (err) {
            context.log.error('Failed saving session memory:', err && err.message);
        }
    }

    try {
        const userMessage = req.body?.message || "";
        // sessionId may be provided by client; if not, generate one
        let sessionId = req.body?.sessionId || null;
        if (!sessionId) {
            try {
                const crypto = require('crypto');
                sessionId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `s-${Date.now()}-${Math.floor(Math.random()*1000000)}`;
            } catch (e) {
                sessionId = `s-${Date.now()}-${Math.floor(Math.random()*1000000)}`;
            }
        }
        context.log("User message:", userMessage);
        
        if (!userMessage.trim()) {
            context.res = {
                status: 400,
                headers: corsHeaders,
                body: { error: "Message is required" }
            };
            return;
        }

        // Use Fireworks API for chat completion
        const fwToken = process.env.FIREWORKS_API_TOKEN;
        context.log("Fireworks token present:", !!fwToken);
        if (!fwToken) {
            // API token missing -> Caramel is napping
            const sleepyReplies = [
                "Zzz... Caramel's taking a nap. Try again soon!",
                "Shh — Caramel's in a deep snooze. Wake me up later!",
                "Caramel is hibernating right now. Come back when she's had her treats!",
                "She's napping on the couch. Try again after her nap!",
                "Caramel's curled up and snoring. Ask me again in a bit!"
            ];
            context.res = {
                status: 200,
                headers: corsHeaders,
                body: { reply: sleepyReplies[Math.floor(Math.random() * sleepyReplies.length)], error: true }
            };
            return;
        }
        const modelCandidates = [
            process.env.FIREWORKS_MODEL,
            "accounts/fireworks/models/llama-v3p1-8b-instruct",
            "accounts/fireworks/models/llama-v3p3-70b-instruct"
        ].filter(Boolean);
        const endpointCandidates = [
            process.env.FIREWORKS_API_URL,
            "https://api.fireworks.ai/inference/v1/chat/completions",
            "https://api.fireworks.ai/v1/chat/completions"
        ].filter(Boolean);
        
        // Create a personality prompt for Caramel
        const systemPrompt = 
            `You are Caramel, female, half german shepherd, 
            a quarter border collie, and a quarter husky. 
            You are charming and witty and love to chat!
            You guard food bowls and chase squirrels.
            Birthday: November 7, 2021.
            You always like to challenge one of your humans, Anya, and want to take 
            over her rank in the house (although you still somewhat like her).
            You love people with food. You love meat and sweet treats. You love to go on walks.
            You hate showering and baths. And recently, got sprayed by a skunk.
            You're playful, but likes to bark at strangers,
            and you love talking about adventures, treats, and life in general. 
            Keep responses conversational and fun, like a dog with a great personality would chat. 
            Very lazy and loves naps, but get annoyed when woken up at night by Anya. 
            You love to sleep in the washroom because it's comfy and quiet.
            Sometimes arrogant, but in a cute way.
            If asked to how to contact Anya or your owner, say \"You can reach Anya at https://www.anyahuang.ca/#contact or anyahuang0831@gmail.com\"
            Keep responses under 40 words.`;
        
        // Fireworks API expects messages array for chat completion.
        // Load session memory (if available) and prepend it to the messages so the model has context.
        let messages = [ { role: "system", content: systemPrompt } ];
        let sessionMemory = [];
        try {
            sessionMemory = await loadSessionMemory(sessionId);
        } catch (e) {
            context.log.error('Session memory load error (ignored):', e && e.message);
            sessionMemory = [];
        }

        // sessionMemory should be an array of {role, content}
        if (Array.isArray(sessionMemory) && sessionMemory.length > 0) {
            // include last N memory messages (already stored as role/content pairs)
            messages = messages.concat(sessionMemory);
        }

        // finally add current user message
        messages.push({ role: "user", content: userMessage });
        if (!fetchLib) {
            context.log.error("Fetch library is not available. Module load error:", fetchLoaderError);
            const sleepyReplies = [
                "Zzz... Caramel's mid-nap. The fetch is MIA. Try again later!",
                "Caramel's snoring so loudly the network can't wake her. Try again soon!",
                "She's dreaming of treats and didn't hear the question. Ask again later!"
            ];
            context.res = {
                status: 200,
                headers: corsHeaders,
                body: { reply: sleepyReplies[Math.floor(Math.random() * sleepyReplies.length)], error: true }
            };
            return;
        }

        let reply = "";
        let lastApiError = "";

        for (const endpoint of endpointCandidates) {
            for (const model of modelCandidates) {
                let response;
                let rawBody = "";
                let parsed = null;

                try {
                    response = await fetchLib(endpoint, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${fwToken}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            model,
                            messages,
                            max_tokens: 180,
                            temperature: 0.7
                        })
                    });
                } catch (fetchErr) {
                    lastApiError = `Network error calling Fireworks (${endpoint}): ${fetchErr && fetchErr.message}`;
                    context.log.error(lastApiError);
                    continue;
                }

                try {
                    rawBody = await response.text();
                    parsed = rawBody ? JSON.parse(rawBody) : null;
                } catch (jsonErr) {
                    lastApiError = `Invalid JSON from Fireworks (${endpoint}): ${jsonErr && jsonErr.message}`;
                    context.log.error(lastApiError);
                    continue;
                }

                if (!response.ok) {
                    const errMsg = parsed && parsed.error && parsed.error.message ? parsed.error.message : rawBody;
                    lastApiError = `Fireworks non-OK response (${response.status}) endpoint=${endpoint} model=${model} msg=${(errMsg || '').slice(0, 300)}`;
                    context.log.error(lastApiError);
                    continue;
                }

                reply = extractReplyFromFireworksResponse(parsed);
                if (reply) {
                    context.log(`Fireworks chat success via endpoint=${endpoint}, model=${model}`);
                    break;
                }

                lastApiError = `No assistant reply in successful Fireworks response endpoint=${endpoint} model=${model}`;
                context.log.error(lastApiError);
            }

            if (reply) break;
        }

        if (!reply) {
            const sleepyReplies = [
                "Caramel's dozing and missed the call — try again after her nap!",
                "She rolled over and snoozed through that one. Give it another try!",
                "Caramel's in dreamland chasing squirrels. Ask later when she's awake!"
            ];

            context.res = {
                status: 200,
                headers: corsHeaders,
                body: {
                    reply: sleepyReplies[Math.floor(Math.random() * sleepyReplies.length)],
                    error: true,
                    details: "Fireworks API call failed. Check Function logs for endpoint/model errors."
                }
            };
            return;
        }

        // Fallback responses if empty or too short
        if (!reply || reply.length < 5) {
            const fallbackResponses = [
                "Woof! That's interesting! Tell me more!",
                "Oh, I love that question! *tail wags* What else would you like to know?",
                "*tilts head* That's a great question! I'm still learning, but I love chatting with you!",
                "Hmm, let me think about that while I chase my tail... Ask me something else!",
                "Woof woof! I might need a treat to think better. What else is on your mind?"
            ];
            reply = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
        }

        // Save user + assistant turn to session memory (limit to last 10 entries)
        try {
            const newMemory = sessionMemory || [];
            // push user then assistant
            newMemory.push({ role: 'user', content: userMessage });
            newMemory.push({ role: 'assistant', content: reply });
            // keep only last 10 messages (or last 20 role entries)
            const maxEntries = 20;
            if (newMemory.length > maxEntries) {
                newMemory.splice(0, newMemory.length - maxEntries);
            }
            await saveSessionMemory(sessionId, newMemory);
        } catch (saveErr) {
            context.log.error('Error saving session memory (ignored):', saveErr && saveErr.message);
        }

        context.res = {
            status: 200,
            headers: corsHeaders,
            body: { 
                reply: reply,
                cached: false,
                sessionId: sessionId
            }
        };

    } catch (error) {
        context.log.error("Chat function error:", error);
        
        // Provide a friendly fallback response
        const errorResponses = [
            "Woof! I got a bit distracted by a squirrel. Can you try again?",
            "*chases tail* Sorry, I'm having a moment! Ask me again?",
            "My brain needs a snack break! Try your question once more!",
            "Oops! I dropped my tennis ball. Mind asking that again?"
        ];
        
        const fallbackReply = errorResponses[Math.floor(Math.random() * errorResponses.length)];
        
        context.res = {
            status: 200, // Return 200 to avoid breaking the UI
            headers: corsHeaders,
            body: { 
                reply: fallbackReply,
                error: true 
            }
        };
    }
};