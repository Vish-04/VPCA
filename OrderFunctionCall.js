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
import { 
    getOrderConversationalRetrievalQAChain, 
    updateOrderConversationalRetrievalQAChain,  
} from "./OrderCQAChain.js"

const model = new ChatOpenAI({ temperature: 0, maxTokens: 5 })

const chatPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
        "Your purpose is to determine which functions to use between the functions getOrder and updateOrder. Use getOrder to list the current orders. Use updateOrder to add, delete, or update items on the current order. Your only response should be the function name or names seperated by spaces and nothing else. The possible responses are as follows 'getOrder', 'updateOrder', 'getOrder updateOrder', 'updateOrder getOrder'. Be sure to list the functions in order of the request, meaning if the user first asks to update thier order, response with updateOrder first. Use the Chat History as context if needed"
    ),
    new MessagesPlaceholder("chat_history"),
    HumanMessagePromptTemplate.fromTemplate("{query}")
])

const formatChatHistory = (userMessage, chatHistory) => {
    const formattedDialogueTurns = chatHistory.map(
      (message) => `${message.role}: ${message.content}`
    );
    return formattedDialogueTurns.join("\n") + `\n user: ${userMessage}`;
};

const chain = new ConversationChain({
    memory: new BufferMemory({ returnMessages: true, memoryKey: "chat_history"}),
    prompt: chatPrompt,
    llm:model, 
})

export const orderHandleFunctionCall = async (userMessage, chatHistory, order) => {
    let modifiableOrder = order || 'no order yet'
    const orderChanges = []
    const fCResponse = await chain.call({
        query: formatChatHistory(userMessage, chatHistory)
    })
    console.log(fCResponse.response)
    const functionCalls = fCResponse.response.split(" ");


    for (const functionCall of functionCalls) { 
        if(functionCall === "getOrder"){
            const lCResponse = await getOrderConversationalRetrievalQAChain.invoke({
                order: modifiableOrder,
                // chat_history: chatHistory
            })
            console.log(lCResponse)
            orderChanges.push({
                function: "getOrder",
                response: lCResponse
            })
        }
        if(functionCall === "updateOrder"){
            const lCResponse = await updateOrderConversationalRetrievalQAChain.invoke({
                question: userMessage,
                chat_history: chatHistory,
                order: modifiableOrder
            })
            modifiableOrder = lCResponse.content
            orderChanges.push({
                function: "updateOrder",
                response: lCResponse.content
            })
        }
    };
    return orderChanges 
};


// let orderChanges = await orderHandleFunctionCall("Add one of those, and make the Vegetable Pakoras Less spicy and add one more? Then repeat my order to me", [
//     {'role':'system', 'content':'You are a restaurant worker named Chad. You are speaking on the phone, always answering in the context of your indian cusine restaurant. Keep your responses to 2-3 sentences or less.'}, 
//     {'role':'assistant', 'content': 'Welcome to VPCA Indian Cusine. How may I help you?'},
//     {'role': 'user', 'content': 'How much does the mango lassi cost?'},
//     {'role': 'assistant', 'content': 'The Mango Lassi costs $4.49' }
// ], 'Vegetable Pakoras, $6.99, 1, none');

// console.log(orderChanges)