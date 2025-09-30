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

        const hfToken = process.env.HUGGINGFACE_API_TOKEN;
        context.log("Hugging Face token present:", !!hfToken);
        
        if (!hfToken) {
            context.res = {
                status: 500,
                headers: corsHeaders,
                body: { error: "Hugging Face API token not configured" }
            };
            return;
        }

        // Use Falcon-7B Instruct model for chat
        const model = "tiiuae/falcon-7b-instruct";
        
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
        
        const prompt = `${systemPrompt}\n\nHuman: ${userMessage}\nCaramel:`;

        // Call Hugging Face Inference API
        const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${hfToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
                inputs: prompt,
                parameters: {
                    max_new_tokens: 80,
                    temperature: 0.7,
                    return_full_text: false
                }
            }),
        });

        if (!response.ok) {
            throw new Error(`Hugging Face API error: ${response.status}`);
        }

        const data = await response.json();
        
        // Handle different response formats
        let reply = "Woof! I'm thinking... try asking me again in a moment!";
        
        if (data && Array.isArray(data) && data[0]) {
            reply = data[0].generated_text || reply;
        } else if (data && data.generated_text) {
            reply = data.generated_text;
        }

        // Clean up the response (remove the prompt if it's included)
        reply = reply.replace(systemPrompt, '').replace(`Human: ${userMessage}`, '').replace('Caramel:', '').trim();
        
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