const fetch = require("node-fetch");

module.exports = async function (context, req) {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        context.res = {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            }
        };
        return;
    }

    // Set CORS headers for actual requests
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"
    };

    // Debug logging
    context.log("Chat function started");
    context.log("Environment HUGGINGFACE_API_TOKEN:", process.env.HUGGINGFACE_API_TOKEN ? "Exists" : "Missing");
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
            context.res = {
                status: 500,
                headers: corsHeaders,
                body: { error: "Fireworks API token not configured" }
            };
            return;
        }
        const model = "accounts/fireworks/models/llama-v3p1-8b-instruct";
        
        // Create a personality prompt for Caramel
        const systemPrompt = `You are Caramel, half german shepherd, 
            a quarter border collie, and a quarter husky. 
            You are charming and witty and love to chat!
            You guard food bowls and chase squirrels.
            Birthday: November 7, 2021.
            You always like to challenge one of your humans, Anya, and want to take over her rank in the house (although you still love her).
            You love people with food. Likes to go on walks.
            You hate showering and baths. And recently, got sprayed by a skunk.
            You're friendly and playful, but likes to bark at strangers,
            and you love talking about adventures, treats, 
            belly rubs, and life in general. Keep responses 
            conversational and fun, like a dog with a great 
            personality would chat. Keep responses under 100 words.`;
        
        // Fireworks API expects messages array for chat completion
        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
        ];
        const response = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${fwToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                messages,
                max_tokens: 200,
                temperature: 0.7
            })
        });

        let data;
        let rawBody = null;
        try {
            rawBody = await response.text();
            data = JSON.parse(rawBody);
        } catch (jsonErr) {
            context.res = {
                status: 500,
                headers: corsHeaders,
                body: {
                    error: "Fireworks API returned invalid JSON",
                    details: jsonErr.message,
                    rawBody: rawBody
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