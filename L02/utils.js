import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const functionsDir = path.join(__dirname, 'functions');

// Ensure the functions directory exists
if (!fs.existsSync(functionsDir)) {
    fs.mkdirSync(functionsDir);
}

// Save a new function from GPT's response
export const saveTool = (toolName, functionCode) => {
    const toolPath = path.join(functionsDir, `${toolName}.js`);
    fs.writeFileSync(toolPath, functionCode);
    console.log(`✅ New function saved: ${toolPath}`);
};

// Dynamically load a function (✅ Corrected)
export const loadTool = async (toolName) => {
    const toolPath = path.join(functionsDir, `${toolName}.js`);

    if (fs.existsSync(toolPath)) {
        try {
            // ✅ Correct dynamic import with absolute path and cache busting
            const module = await import(`file://${toolPath}?update=${Date.now()}`);
            return module; // ✅ Return { execute, details }
        } catch (error) {
            console.error(`⚠️ Failed to import ${toolName}:`, error);
            return null;
        }
    } else {
        console.log(`⚠️ Function not found: ${toolName}`);
        return null;
    }
};
