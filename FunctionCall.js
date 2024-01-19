import { ChatOpenAI } from "langchain/chat_models/openai"
import {
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate,
    MessagesPlaceholder,
} from "langchain/prompts"
import {ConversationChain } from "langchain/chains"
import { config } from "dotenv";
config();

import { BufferMemory } from "langchain/memory"
import {conversationalRetrievalQAChain} from "./ConversationalQAChain.js"

const model = new ChatOpenAI({ temperature: 0, maxTokens: 4 })
const chatPrompt = ChatPromptTemplate.fromPromptMessages([
    SystemMessagePromptTemplate.fromTemplate(
        "Your purpose is to determine which of the functions to use between the functions 'queryRestaurant' and 'redirect' when given the customers query. Use queryRestaurant to address any questions and inquiries about the restaurant and the menu but not for anything related to ordering food. Use redirect to handle any ordering action, including adding an item to the the order, removing an item, and modifying an item or for any personal request to speak to staff of the restaurant. Your only response should be the function name or names seperated by spaces and nothing else"
    ),
    new MessagesPlaceholder("chat_history"),
    HumanMessagePromptTemplate.fromTemplate("{query}")
])

const chain = new ConversationChain({
    memory: new BufferMemory({ returnMessages: true, memoryKey: "chat_history"}),
    prompt: chatPrompt,
    llm:model,
})


export const handleFunctionCall = async (userMessage, chatHistory, order) => {
    const response = []
    const fCResponse = await chain.call({
        query: userMessage,
    })
    const functionCalls = await fCResponse.response.split(" ")
    console.log(functionCalls)

    for (const functionCall of functionCalls) {
        if (functionCall === "queryRestaurant"){
            const lCResponse = await conversationalRetrievalQAChain.invoke({
                question: userMessage,
                chat_history: chatHistory
            })
            console.log(lCResponse)
            response.push({
                function: 'queryRestaurant', 
                response: lCResponse.content
            })
        }
        if(functionCall === "redirect"){
                response.push({
                    function: 'redirect',
                    response: 'Our live staff are better suited for this operation, redirecting your call.'
                })
        }
    }
    console.log("RESPONSE", response)
    return response
};



// Call the function with a sample user message
// handleFunctionCall("Whats on the Menu Today", [
//     {'role':'system', 'content':'You are a restaurant worker named Chad. You are speaking on the phone, always answering in the context of your indian cusine restaurant. Keep your responses to 2-3 sentences or less.'}, 
//     {'role':'assistant', 'content': 'Welcome to VPCA Indian Cusine. How may I help you?'},
// ]);