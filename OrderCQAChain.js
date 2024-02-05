import { config } from "dotenv";
config();

import { ChatOpenAI } from "langchain/chat_models/openai"
import { PromptTemplate } from "langchain/prompts"
import { OpenAIEmbeddings } from "langchain/embeddings/openai"
import { FaissStore } from "langchain/vectorstores/faiss"
import {
  RunnableSequence,
  RunnablePassthrough,
} from "langchain/schema/runnable";
import { StringOutputParser } from "langchain/schema/output_parser";
import { formatDocumentsAsString } from "langchain/util/document";

const embeddings = new OpenAIEmbeddings();

const vectorStore = await FaissStore.load("./", embeddings)

const retriever = vectorStore.asRetriever();

const model = new ChatOpenAI({ temperature: 0 })

const formatChatHistory = (chatHistory) => {
    const formattedDialogueTurns = chatHistory.map(
      (message) => `${message.role}: ${message.content}`
    );
    return formattedDialogueTurns.join("\n");
};

//Get Order Chain
const getOrderAnswerTemplate = `Your job is to repeat the order back to the customer as a restaurant worker at an pizzaria when given the customers question and Order below. Ensure that you respond with the order of the item, quantity, and any notes/modifications (if there are none dont mention modifications) one by one keeping it short. At the end mention the total combined price of the entire order. If there is no order state that there is none. The order consists of the following format where multiple menu items are seperated by commas in the same format Ex: Bread Sticks, $4.49, 1, none, Fountain Drink, $3.99, 2, large. Remove fluff and keep your answer short without excluding information.

Question: Can you repeat my order to me from the order below?
Order: {order}
Chad:
`;

const GET_ORDER_ANSWER_PROMPT = PromptTemplate.fromTemplate(getOrderAnswerTemplate);  
  
export const getOrderConversationalRetrievalQAChain = RunnableSequence.from([
    {
      // context: retriever.pipe(formatDocumentsAsString),
      order: (input) => input.order,
      // chat_history: (input) => formatChatHistory(input.chat_history)
    },
    GET_ORDER_ANSWER_PROMPT,
    model,
    new StringOutputParser(),
  ]);

//update Order Chain
const updateOrderQuestionTemplate = `Given the following conversation, a follow up question which contians information to change an order by either adding, modifying, or removing items from the order, and the current order , your job is to rephrase the follow up question to be a standalone question and append the order to it, in its original language. Use the chat history only if relevant, else ignore. DO NOT change the order at all and only add it to the end of the standalone question. If there is anything about fetching the current order ignore it in the question. Remove fluff and keep your answer short without excluding information.

Chat History:
{chat_history}
Follow Up Input: {question}
Order: {order}
Standalone question + order:`;

const UPDATE_ORDER_QUESTION_PROMPT = PromptTemplate.fromTemplate(
  updateOrderQuestionTemplate
);

const updateOrderChain = RunnableSequence.from([
  {
    question: (input) => input.question,
    chat_history: (input) =>
      formatChatHistory(input.chat_history),
    order: (input) => input.order
  },
  UPDATE_ORDER_QUESTION_PROMPT,
  model,
  new StringOutputParser(),
]);

const updateOrderAnswerTemplate = `your job is to update the order from the order on the system with the request from the user in the question, and cross check the context to ensure that the order is proper. Don't use the context if not needed. Respond in the following format consisting of dish name, price, quantity, and notes. Ex: Bread Sticks, $3.99, 1, no butter. If there are more than one types of dishes being ordered, chain them together with commas and only commas. Ex: Bread Sticks, $3.99, 1, no butter, Pizza, $4.49, 2, none. Ignore any remarks about fetching the order in the question and only respond in the format given. If the item requested does not exist on the menu disregard it and move on. Remove fluff and keep your answer short without excluding information:
{context}

Question + Order: {question}
`;

const UPDATE_ORDER_ANSWER_PROMPT = PromptTemplate.fromTemplate(updateOrderAnswerTemplate);  
  
  const updateOrderAnswerChain = RunnableSequence.from([
    {
      context: retriever.pipe(formatDocumentsAsString),
      question: new RunnablePassthrough(),
    },
    UPDATE_ORDER_ANSWER_PROMPT,
    model,
  ]);
  
export const updateOrderConversationalRetrievalQAChain =
  updateOrderChain.pipe(updateOrderAnswerChain);


//update Order Chain
const combineFunctionCallQuestionTemplate = `You are a restaurant worker named Chad working at NV pizzaria and you are given the following conversation and an input. The input consists of upto four things, including userMessage, which is the request of the user, updateOrder, which is the updated and changed version of the order, getOrder, which contains a response detailing the contents of the order, and queryRestaurant, which provides an answer to any inquiry regarding the restaurant or menu. Your job is to account for all the inputs using the Chat History as well if necessary, to come up with an appropriate response to the userMessage. Remove fluff and keep your answer short, but dont leave out any modifications or quantity if relevant.

Chat History:
{chat_history}
Input: {question}
Chad:`;

const COMBINE_FUNCTION_CALL_QUESTION_PROMPT = PromptTemplate.fromTemplate(
  combineFunctionCallQuestionTemplate
);

export const combineFunctionCallConversationalRetrievalQAChain = RunnableSequence.from([
  {
    question: (input) => input.question,
    chat_history: (input) =>
      formatChatHistory(input.chat_history),
  },
  COMBINE_FUNCTION_CALL_QUESTION_PROMPT,
  model,
  new StringOutputParser(),
]);