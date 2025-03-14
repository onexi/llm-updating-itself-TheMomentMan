const execute = async ({ number1, number2 }) => {
    if (typeof number1 !== "number" || typeof number2 !== "number") {
        throw new Error("Both parameters must be numbers.");
    }
    return { result: number1 * number2 };
};

const details = {
    type: "function",
    function: {
        name: "MultiplyNumbers",
        parameters: {
            type: "object",
            properties: {
                number1: { type: "number", description: "The first number" },
                number2: { type: "number", description: "The second number" }
            },
            required: ["number1", "number2"]
        }
    },
    description: "A function that performs the MultiplyNumbers operation."
};

export { execute, details };