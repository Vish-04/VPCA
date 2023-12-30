import { config } from "dotenv";
config();

import { TextLoader } from "langchain/document_loaders/fs/text"
import { CharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "langchain/embeddings/openai"
import { FaissStore } from "langchain/vectorstores/faiss"


// UNCOMMENT WHEN RELOADING THE VECTOR STORE
const loader = new TextLoader("./menu_faq.txt")

const docs = await loader.load()

const splitter = new CharacterTextSplitter({
    chunkSize: 100,
    chunkOverlap: 50
});


const documents = await splitter.splitDocuments(docs)


const embeddings = new OpenAIEmbeddings();

const vectorstore = await FaissStore.fromDocuments(documents, embeddings)
await vectorstore.save("./")