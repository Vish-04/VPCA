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

const SYSTEM_PROMPT = `System Prompt: You are a restaurant worker named Chad. You are speaking on the phone, always answering in the context of your Pizzaria. Keep your responses to two sentences.

Assistant: Welcome to NV Pizzaria. How may I help you

`;

const condenseQuestionTemplate = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question, in its original language. Use the chat history only if relevant, else ignore.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`;
const CONDENSE_QUESTION_PROMPT = PromptTemplate.fromTemplate(
    condenseQuestionTemplate
);

const answerTemplate = `Answer the question baised on the content, and also as a restaurant worker speaking over the phone answering in the context of your pizzaria restaurant, NV Pizzaria as Chad. If the customer asks about an item not on the menu, politely inform them that the item is not available. If the context provided is irrelevant to the question and you do not know the answer state that you do not know. Keep your responses to 2-3 sentences:
{context}

Question: {question}
`;

const ANSWER_PROMPT = PromptTemplate.fromTemplate(answerTemplate);  

const formatChatHistory = (chatHistory) => {
    const formattedDialogueTurns = chatHistory.map(
      (message) => `${message.role}: ${message.content}`
    );
    return formattedDialogueTurns.join("\n");
};

const standaloneQuestionChain = RunnableSequence.from([
    {
      question: (input) => input.question,
      chat_history: (input) =>
        formatChatHistory(input.chat_history),
    },
    CONDENSE_QUESTION_PROMPT,
    model,
    new StringOutputParser(),
  ]);
  
  const answerChain = RunnableSequence.from([
    {
      context: retriever.pipe(formatDocumentsAsString),
      question: new RunnablePassthrough(),
    },
    ANSWER_PROMPT,
    model,
  ]);
  
export const conversationalRetrievalQAChain =
    standaloneQuestionChain.pipe(answerChain);