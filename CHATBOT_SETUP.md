# Caramel Chatbot Setup Guide

## 🐕 Welcome to the Caramel Chatbot!

This guide will help you set up the AI chatbot feature for your Caramel website using Hugging Face's free API.

## 1️⃣ Get Your Hugging Face API Token

1. Visit [Hugging Face](https://huggingface.co) and create a free account
2. Go to your [Settings → Access Tokens](https://huggingface.co/settings/tokens)
3. Click "New token"
4. Choose "Read" or "API" scope
5. Copy your token (it looks like: `hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

## 2️⃣ Configure Azure Function App Settings

### If deploying to Azure:
1. Go to your Azure Function App in the Azure portal
2. Navigate to **Configuration** → **Application Settings**
3. Add a new application setting:
   - **Name**: `HUGGINGFACE_API_TOKEN`
   - **Value**: Your Hugging Face token (from step 1)
4. Save the configuration

### For local development:
1. Update your `local.settings.json` file:
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "HUGGINGFACE_API_TOKEN": "your_token_here"
  }
}
```

## 3️⃣ Install Dependencies

In your `/api/chat/` directory, run:
```bash
npm install
```

This will install the required `node-fetch` dependency.

## 4️⃣ Test the Chatbot

1. Start your Azure Function locally or deploy to Azure
2. Open your website
3. Click the "Chat with Caramel 🐕" button in the bottom right
4. Try some test messages:
   - "Hello!"
   - "Good boy"
   - "Treats"
   - "Tell me about yourself"

## 🎉 Features Included

- **Smart Caching**: Repeated questions get instant responses
- **Fallback Responses**: Friendly messages when API is down
- **Mobile Responsive**: Works great on phones and tablets
- **Golden Theme**: Matches your website's color scheme
- **Personality**: Caramel has a fun, dog-like personality!

## 🔧 Customization Options

### Change the AI Model
Edit `/api/chat/index.js` and modify the `model` variable:
```javascript
const model = "microsoft/DialoGPT-medium"; // Current model
// Try these alternatives:
// "tiiuae/falcon-7b-instruct"
// "microsoft/DialoGPT-large"
```

### Adjust Personality
Modify the `systemPrompt` in `/api/chat/index.js`:
```javascript
const systemPrompt = `You are Caramel, a charming and witty golden retriever...`;
```

### Add More Cached Responses
Edit the startup cache in `/src/script.js`:
```javascript
chatCache['your_keyword'] = "Custom response here!";
```

## 💰 Free Tier Limits

- **Hugging Face**: ~30,000-50,000 tokens/month
- **Azure Functions**: 1M requests/month
- **Tips to save tokens**:
  - Keep responses under 100 words
  - Use caching for common questions
  - Monitor usage in Hugging Face dashboard

## 🚨 Troubleshooting

### "Hugging Face API token not configured"
- Make sure you added the environment variable correctly
- Check for typos in the variable name
- Restart your function app after adding the variable

### "Model is loading" responses
- Some models need time to "warm up" on first use
- Try again in 1-2 minutes
- Consider switching to a faster model

### CORS errors
- The function includes CORS headers
- If issues persist, check your domain is allowed

## 🎈 Have Fun!

Your visitors can now chat with Caramel about anything! The bot will respond with personality and charm, making your website more interactive and engaging.

Remember: Caramel loves treats, walks, belly rubs, and good conversation! 🐾