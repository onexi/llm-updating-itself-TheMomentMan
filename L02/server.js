import express from 'express';
import bodyParser from 'body-parser';
import { OpenAI } from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from "fs";
import { loadTool, saveTool } from './utils.js';  // New helper module

import dotenv from 'dotenv';
dotenv.config();

// Now you can access your API key using:
// process.env.OPENAI_API_KEY

// Initialize Express server
const app = express();
app.use(bodyParser.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.resolve(process.cwd(), './public')));

// OpenAI API configuration
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Function to load existing functions from the /functions folder
async function getFunctions() {
    const files = fs.readdirSync(path.resolve(process.cwd(), "./functions"));
    const openAIFunctions = {};

    for (const file of files) {
        if (file.endsWith(".js")) {
            const moduleName = file.slice(0, -3);
            const modulePath = `./functions/${moduleName}.js`;
            const { details, execute } = await import(modulePath);

            openAIFunctions[moduleName] = { details, execute };
        }
    }
    return openAIFunctions;
}

// New: Function to generate a missing function using GPT
async function generateFunctionWithGPT(functionName) {
    console.log(`🚀 Generating function "${functionName}" via GPT...`);

    // Construct a prompt asking GPT to write the function
    const prompt = `
Write a JavaScript function named "execute" to perform the operation "${functionName}". 
Also, define a constant named "details" that describes the function and its parameters.
Your response should follow this exact format:

const execute = async ({ number1, number2 }) => {
    if (typeof number1 !== "number" || typeof number2 !== "number") {
        throw new Error("Both parameters must be numbers.");
    }
    return { result: number1 * number2 }; // Adjust based on functionName
};

const details = {
    type: "function",
    function: {
        name: "${functionName}",
        parameters: {
            type: "object",
            properties: {
                number1: { type: "number", description: "The first number" },
                number2: { type: "number", description: "The second number" }
            },
            required: ["number1", "number2"]
        }
    },
    description: "A function that performs the ${functionName} operation."
};

Export the function and details using:
export { execute, details };

Provide a working implementation for "${functionName}".
`;


    const gptResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }]
    });

    let functionCode = gptResponse.choices[0].message.content;

    // ✅ Extract just the JavaScript code from GPT markdown response
    const match = functionCode.match(/```javascript([\s\S]*?)```/);
    if (match) {
        functionCode = match[1].trim();
    } else {
        throw new Error("⚠️ GPT did not return a valid JavaScript code block.");
    }

    // Save the generated function code to the /functions folder
    saveTool(functionName, functionCode);

    // Load and return the newly generated function
    return await loadTool(functionName);
}



// Modified route: If a function is missing, generate it automatically
app.post('/execute-function', async (req, res) => {
    const { functionName, parameters } = req.body;
    let functions = await getFunctions();

    if (!functions[functionName]) {
        console.log(`⚠️ Function "${functionName}" not found. Generating it now...`);
        try {
            const generatedFunction = await generateFunctionWithGPT(functionName);
            if (!generatedFunction) {
                return res.status(500).json({ error: 'Failed to generate function.' });
            }
            // Update functions object with the newly generated function
            //functions[functionName] = { execute: generatedFunction };
            functions[functionName] = generatedFunction;

        } catch (err) {
            return res.status(500).json({ error: 'Error generating function', details: err.message });
        }
    }
    try {
        // Execute the function with provided parameters
        //const result = await functions[functionName].execute(...Object.values(parameters));
        const result = await functions[functionName].execute(parameters);
        console.log(`✅ Execution result: ${JSON.stringify(result)}`);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Function execution failed', details: err.message });
    }
});

// Existing route to interact with OpenAI API for function calls
app.post('/openai-function-call', async (req, res) => {
    const { userPrompt } = req.body;

    const functions = await getFunctions();
    const availableFunctions = Object.values(functions).map(fn => fn.details);

    try {
        const response = await openai.createChatCompletion({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: userPrompt }
            ],
            functions: availableFunctions
        });

        const completion = response.data.choices[0];
        const calledFunction = completion.function_call;

        if (calledFunction) {
            const functionName = calledFunction.name;
            const parameters = JSON.parse(calledFunction.arguments);

            //const result = await functions[functionName].execute(...Object.values(parameters));
            const result = await functions[functionName].execute(parameters);
            res.json({ result });
        } else {
            res.json({ message: 'No function call detected.' });
        }
    } catch (error) {
        res.status(500).json({ error: 'OpenAI API failed', details: error.message });
    }
});

// Default route to serve index.html
app.get('*', (req, res) => {
    res.sendFile(path.resolve(process.cwd(), './public/index.html'));
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});