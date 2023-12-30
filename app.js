import express from 'express';
import twilio from 'twilio';
import bodyParser from 'body-parser';
import { config } from "dotenv";
config();
import OpenAI from 'openai';
import { handleFunctionCall } from './FunctionCall.js';
import { combineFunctionCallConversationalRetrievalQAChain } from "./OrderCQAChain.js";
import { conversationalRetrievalQAChain } from './ConversationalQAChain.js';

const app = express();
app.use(bodyParser.urlencoded({ extended: false })); 

// const openai = new OpenAI({});

const chatHistory = [
    {'role':'system', 'content':'You are a restaurant worker named Chad. You are speaking on the phone, always answering in the context of your indian cusine restaurant. Keep your responses to 2-3 sentences or less.'}, 
    {'role':'assistant', 'content': 'Welcome to VPCA Indian Cusine. How may I help you?'},
]

let order = ""

// Handle incoming calls from Twilio
app.post('/call', twilio.webhook({ validate: false }), async (req, res) => {

  chatHistory.splice(0, chatHistory.length)
  order = ""
  
  const response = new twilio.twiml.VoiceResponse();

  const gather = response.gather(
    {
        action: '/process_input', 
        input: "speech", 
        speechTimeout: 1,
        timeout: 5,
        method: 'POST'
    }
  );
  gather.say("Welcome to VPCA Indian Cusine. How may I help you?")

  res.type('text/xml');
  res.send(response.toString());
});

app.post('/process_input', twilio.webhook({ validate: false }), async (req, res) => {
  const response = new twilio.twiml.VoiceResponse();

  const userMessage = req.body?.SpeechResult;
  console.log("userMessage", userMessage)

  if (!userMessage){
    response.say("Call Timed Out - Goodbye Now")
    return;
  } else {
      
      try {

        const botResponses = await handleFunctionCall(userMessage, chatHistory, order)

        // const lc_response = await conversationalRetrievalQAChain.invoke({
        //     question: userMessage,
        //     chat_history: chatHistory
        // })

        // change to .response if RAG not in use else.text and .content 
        // const botResponse = lc_response.content

        if(botResponses.length == 1 && botResponses[0].function === 'queryRestaurant'){
            // Create a TwiML response to speak the bot's response
            response.say(botResponses[0].response);
            console.log("Response", botResponses[0].response)

            chatHistory.push({'role':'user', 'content': userMessage}, {'role':'assistant', 'content': botResponses[0].response})
        } else{
            
            const combinedFunctions = botResponses.map((botResponse)=>{
                (botResponse.function === ' updateOrder' ? order = botResponse.response : null)
                return `${botResponse.function}: ${botResponse.response}`
            }).join('\n')
            console.log("ORDER", order)
            const cFCResponse = await combineFunctionCallConversationalRetrievalQAChain.invoke({
                question: `userMessage: ${userMessage}\n` + combinedFunctions,
                chat_history: chatHistory,
            })
            response.say(cFCResponse);
            console.log("Response", cFCResponse)

            chatHistory.push({'role':'user', 'content': userMessage}, {'role':'assistant', 'content': cFCResponse})
        }
                
        const gather = response.gather(
            {
                action: '/process_input', 
                input: "speech", 
                speechTimeout: 1,
                timeout:5,
                method: 'POST'
            }
          );
      } catch (err) {
        console.error('Error:', err);
        response.say('Apologies, there was an error processing your request.');
      }
    
      res.type('text/xml');
      res.send(response.toString());
      
  }
});

// const test = async () =>{
//     const um = 'Sounds good, thank you!'
//     const botResponses = await handleFunctionCall(
//         um, 
//         [
//             {'role':'system', 'content':'You are a restaurant worker named Chad. You are speaking on the phone, always answering in the context of your indian cusine restaurant. Keep your responses to 2-3 sentences or less.'}, 
//             {'role':'assistant', 'content': 'Welcome to VPCA Indian Cusine. How may I help you?'},
//             {'role': 'user', 'content': 'What are your most popular items on the menu'},
//             {'role':'assistant', 'content': 'The most popular items on our menu at VPCA Indian Cuisine are the Butter Chicken, Samosa Chaat, and Tandoori Mixed Grill.'},
//             {'role': 'user', 'content': 'Great! What is the price of them?'},
//             {'role':'assistant', 'content': 'The price of the Butter Chicken is $14.99, the Samosa Chaat is $7.99, and the Tandoori Mixed Grill is $18.99 at VPCA Indian Cuisine.'},
//             {'role': 'user', 'content': 'Can I get the first item?'},
//             {'role':'assistant', 'content': "Sure, you can get the Butter Chicken for $14.99. Is there anything else you would like to order?"},
//             {'role': 'user', 'content': 'Yeah can you also add a mango lassi and make it extra sweet'},
//             {'role':'assistant', 'content': "Sure, I've added a Mango Lassi to your order and made it extra sweet. Is there anything else I can assist you with?"},
//             {'role': 'user', 'content': 'Can you give me some vegetarian options, preferrable without any onions or garlic?'},
//             {'role':'assistant', 'content': "We have several vegetarian options on our menu that do not contain onions or garlic. Some options include Palak Paneer, Vegetable Biryani, and Plain Paratha."},
//             {'role': 'user', 'content': 'Can I get a Vegetable Biryani without any onions and with extra raitha. Also make it spicy?'},
//             {'role':'assistant', 'content': "Sure, I have updated your order to include a Vegetable Biryani without onions, extra raitha, and spicy. Your total order now consists of Butter Chicken, 1 quantity, Mango Lassi, 1 quantity with extra sweetness, and Vegetable Biryani without onions, extra raitha, and spicy. The total price is $19.48."},
//             {'role': 'user', 'content': 'Sounds good, thank you!'},
//             {'role':'assistant', 'content': "You're welcome! Let me know if you have any questions or if there's anything else I can assist you with."}
//         ] 
//         , 
//         'Butter Chicken, $14.99, 1, Mango Lassi, $4.49, 1, extra sweet.'
//         )
//     console.log("BOT RESPONSES", botResponses)

//     if(botResponses.length == 1 && botResponses[0].function === 'queryRestaurant'){
//         console.log("Response", botResponses[0].response)
//     } else{        
//         const combinedFunctions = botResponses.map((botResponse)=>{
//             (botResponse.function === ' updateOrder' ? order = botResponse.response : null)
//             return `${botResponse.function}: ${botResponse.response}`
//         }).join('\n')
//         const cFCResponse = await combineFunctionCallConversationalRetrievalQAChain.invoke({
//             question: `userMessage: ${um}\n` + combinedFunctions,
//             chat_history: chatHistory,
//         })
//         console.log("Response", cFCResponse)
//     }
// }

// await test()

// Start the Express server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
