# AI Service Setup

## Story 10A.1: Natural Language Task Creation

This document describes how to configure the AI service for natural language task creation.

## Environment Variables

Add the following environment variables to your `.env.local` file (or your deployment environment):

### OpenAI (Default)

```bash
# AI Provider (optional, defaults to 'openai')
AI_PROVIDER=openai

# OpenAI API Key (required if using OpenAI)
OPENAI_API_KEY=sk-...

# OpenAI Model (optional, defaults to 'gpt-4o-mini')
OPENAI_MODEL=gpt-4o-mini
```

### Anthropic (Alternative)

```bash
# AI Provider
AI_PROVIDER=anthropic

# Anthropic API Key (required if using Anthropic)
ANTHROPIC_API_KEY=sk-ant-...

# Anthropic Model (optional, defaults to 'claude-3-5-sonnet-20241022')
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

### Google Gemini (Alternative)

```bash
# AI Provider
AI_PROVIDER=gemini

# Gemini API Key (required if using Gemini)
GEMINI_API_KEY=your-gemini-api-key

# Gemini Model (optional, defaults to 'gemini-1.5-pro')
# Available models: gemini-1.5-pro, gemini-1.5-flash, gemini-pro, gemini-pro-vision
GEMINI_MODEL=gemini-1.5-pro
```

### Legacy Support

For backward compatibility, you can also use:

```bash
# Generic AI API Key (will be used for either provider)
AI_API_KEY=sk-...
```

## Getting API Keys

### OpenAI

1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Create a new API key
4. Copy the key (starts with `sk-`)
5. Add to your `.env.local` file

### Anthropic

1. Go to https://console.anthropic.com/
2. Sign in or create an account
3. Navigate to API Keys
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)
6. Add to your `.env.local` file

### Google Gemini

1. Go to https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Select or create a Google Cloud project
5. Copy the API key
6. Add to your `.env.local` file as `GEMINI_API_KEY`

## Usage

Once configured, users can:

1. Navigate to the task creation page
2. Enter a natural language description of the task
3. Click "Extract Task Information"
4. Review and edit the extracted information
5. Create the task

## Example Natural Language Inputs

- "Create a login page with email and password authentication. This is a medium-sized task worth about 15 COOK."
- "Set up CI/CD pipeline for the project. Large task, around 40 COOK."
- "Research best practices for React state management. Small research task, 5 COOK."
- "Update the governance policy document. Governance task, 20 COOK."

## AI Extraction Features

The AI extracts:

- **Title**: A concise, clear task title
- **Description**: Detailed description (if provided)
- **Estimated COOK Value**: Estimated COOK value (1-100, if mentioned)
- **Task Type**: One of Build, Ops, Governance, Research (inferred from context)

## Logging

All AI extractions are logged for improvement:

- Input description
- Extracted output
- Model used
- Timestamp
- User ID and Team ID
- Confidence score

Logs are stored in Firestore at `teams/{teamId}/aiExtractionLogs/{logId}` (to be implemented in Cloud Function).

## Troubleshooting

### "AI API key not configured"

- Ensure you've added the API key to your `.env.local` file
- Restart your development server after adding environment variables
- For production, ensure environment variables are set in your deployment platform

### "Failed to extract task information"

- Check your API key is valid and has sufficient credits
- Verify your internet connection
- Check the browser console and server logs for detailed error messages
- The system will fall back to basic extraction if AI fails

### Rate Limiting

- OpenAI and Anthropic have rate limits based on your plan
- If you hit rate limits, wait a few minutes and try again
- Consider upgrading your API plan for higher limits

## Cost Considerations

- OpenAI GPT-4o-mini: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- Anthropic Claude 3.5 Sonnet: ~$3 per 1M input tokens, ~$15 per 1M output tokens
- Google Gemini 1.5 Pro: ~$1.25 per 1M input tokens, ~$5 per 1M output tokens
- Google Gemini 1.5 Flash: ~$0.075 per 1M input tokens, ~$0.30 per 1M output tokens

For typical task extraction (100-200 tokens), costs are minimal (< $0.001 per extraction).

## Security

- **Never commit API keys to version control**
- Use environment variables for all API keys
- Rotate API keys regularly
- Monitor API usage for unexpected activity
- Consider using API key restrictions (IP whitelisting, usage limits)
