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

    try {
        const userMessage = req.body?.message || "";
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
        const model = "accounts/fireworks/models/llama-v3p1-8b-instruct";
        
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
            Sometimes arrogant and sassy, but in a cute way.
            If asked to how to contact Anya or your owner, say \"You can reach Anya at https://anyahuang.page#contact or anyahuang0831@gmail.com\"
            Keep responses under 50 words.`;
        
        // Fireworks API expects messages array for chat completion
        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
        ];
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

        let response;
        try {
            response = await fetchLib("https://api.fireworks.ai/inference/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${fwToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model,
                    messages,
                    max_tokens: 50,
                    temperature: 0.7
                })
            });
        } catch (fetchErr) {
            context.log.error("Error while calling Fireworks API:", fetchErr && fetchErr.message);
            const sleepyReplies = [
                "Caramel's dozing and missed the call — try again after her nap!",
                "She rolled over and snoozed through that one. Give it another try!",
                "Caramel's in dreamland chasing squirrels. Ask later when she's awake!"
            ];
            context.res = {
                status: 200,
                headers: corsHeaders,
                body: { reply: sleepyReplies[Math.floor(Math.random() * sleepyReplies.length)], error: true }
            };
            return;
        }

        let data;
        let rawBody = null;
        try {
            rawBody = await response.text();
            data = JSON.parse(rawBody);
        } catch (jsonErr) {
            // Do not leak the token. Use a sleepy reply rather than verbose diagnostics.
            context.log.error("Invalid JSON from Fireworks API (masked):", jsonErr && jsonErr.message);
            const sleepyReplies = [
                "Zzz... Caramel's processing dreams. Try again soon!",
                "She's snoozing and couldn't think of a reply — try again later!",
                "Caramel's stuck in a nap loop. Ask later when she's awake!"
            ];

            context.res = {
                status: 200,
                headers: corsHeaders,
                body: {
                    reply: sleepyReplies[Math.floor(Math.random() * sleepyReplies.length)],
                    error: true
                }
            };
            return;
        }
        let reply = "Woof! I'm thinking... try asking me again in a moment!";
        if (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
            reply = data.choices[0].message.content.trim();
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

        context.res = {
            status: 200,
            headers: corsHeaders,
            body: { 
                reply: reply,
                cached: false 
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