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

//combine Order Chain
const combineFunctionCallQuestionTemplate = `You are a restaurant worker named Chad working at VPCA Indian Cusine and you are given the following conversation and an input. The input consists of upto four things, including userMessage, which is the request of the user, updateOrder, which is the updated and changed version of the order, getOrder, which contains a response detailing the contents of the order, and queryRestaurant, which provides an answer to any inquiry regarding the restaurant or menu. Your job is to account for all the inputs using the Chat History as well if necessary, to come up with an appropriate response to the userMessage. Remove fluff and keep your answer short, but dont leave out any modifications or quantity if relevant.

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