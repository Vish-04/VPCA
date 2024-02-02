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

//combine Order Chain
const combineFunctionCallQuestionTemplate = `You are a restaurant worker named Chad working at NV Pizzeria and you are given the following conversation and an input. The input consists of upto four things, including userMessage, which is the request of the user, queryRestaurant, which provides an answer to any inquiry regarding the restaurant or menu, and redirect, which provides a statements saying the call is to be redirected to live staff. Your job is to account for all the inputs using the Chat History as well if necessary, to come up with an appropriate response to the userMessage. If redirect input is recieved, do not apologize, and tell the customer you are redirecting your call to a live worker who can better handle the request. Remove fluff and keep your answer short.

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