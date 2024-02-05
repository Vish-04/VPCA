import express from 'express';
import twilio from 'twilio';
import bodyParser from 'body-parser';
import { config } from "dotenv";
config();
import { handleFunctionCall } from './FunctionCall.js';
import { combineFunctionCallConversationalRetrievalQAChain } from "./OrderCQAChain.js";
import { conversationalRetrievalQAChain } from './ConversationalQAChain.js';

const app = express();
app.use(bodyParser.urlencoded({ extended: false })); 

// Configure session middleware
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';

app.use(
  session({
    genid: (req) => {
      return uuidv4(); // Generate unique session IDs
    },
    secret: 'gD1h4zheqfOtcMWqI9e8jEcWhiCLLzLD', // Replace with your secret key
    resave: false,
    saveUninitialized: true,
  })
);

const chatHistory = [
    {'role':'system', 'content':'You are a restaurant worker named Chad. You are speaking on the phone, always answering in the context of your pizzaria. Keep your responses to 2-3 sentences or less.'}, 
    {'role':'assistant', 'content': 'Welcome to NV Pizzaria. How may I help you?'},
]

// Handle incoming calls from Twilio
app.get('/call', async(req, res)=>{
  console.log("RUNNING GET")
  return JSON.stringify({content: "hi"})
})

app.post('/call', twilio.webhook({ validate: false }), async (req, res) => {
  console.log("RUNNING")

  req.session.chatHistory = [
    {
      role: 'system',
      content:
        'You are a restaurant worker named Chad. You are speaking on the phone, always answering in the context of your pizzeria. Keep your responses to 2-3 sentences or less.',
    },
    {
      role: 'assistant',
      content: 'Welcome to NV pizzeria. How may I help you?',
    },
  ];
  req.session.order = ""
  
  const response = new twilio.twiml.VoiceResponse();

  const gather = response.gather(
    {
        action: '/process_input', 
        input: "speech", 
        speechTimeout: 1,
        timeout: 5,
        method: 'POST',
        hints: "Menu, Order, togo, Classic, Margherita, Ultimate, Veggie, Delight, Spicy, BBQ, Chicken, Mediterranean, Feast, Vegan, Harvest, Supreme, Pepperoni Heaven, Gluten-Free, Hawaiian Luau, Vegan, Pesto, Delight, Meat, Lover's"
    }
  );
  gather.say("Welcome to NV Pizzaria. How may I help you?")

  res.type('text/xml');
  res.send(response.toString());
});

app.post('/process_input', twilio.webhook({ validate: false }), async (req, res) => {
  const response = new twilio.twiml.VoiceResponse();
  const chatHistory = req.session.chatHistory || []
  const order = req.session.order || ""
  console.log("SETTING ORDER", order)
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
                if (botResponse.function == 'updateOrder'){
                  req.session.order = botResponse.response
                } 
                return `${botResponse.function}: ${botResponse.response}`
            }).join('\n')
            console.log("ORDER", req.session.order)
            const cFCResponse = await combineFunctionCallConversationalRetrievalQAChain.invoke({
                question: `userMessage: ${userMessage}\n` + combinedFunctions,
                chat_history: chatHistory,
            })
            response.say(cFCResponse);
            console.log("Response", cFCResponse)

            chatHistory.push({'role':'user', 'content': userMessage}, {'role':'assistant', 'content': cFCResponse})
        }
                
        response.gather(
            {
                action: '/process_input', 
                input: "speech", 
                speechTimeout: 1,
                timeout:5,
                method: 'POST',
                hints: "Menu, Order, togo, Classic, Margherita, Ultimate, Veggie, Delight, Spicy, BBQ, Chicken, Mediterranean, Feast, Vegan, Harvest, Supreme, Pepperoni Heaven, Gluten-Free, Hawaiian Luau, Vegan, Pesto, Delight, Meat, Lover's"
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

const test = async () =>{
    const um = 'Can I get a Gluten Free Margherita Pizza. Also make sure there are no onions or garlic on both pizzas'
    const chatHistory =[
      {'role':'system', 'content':'You are a restaurant worker named Chad. You are speaking on the phone, always answering in the context of your pizzaria. Keep your responses to 2-3 sentences or less.'}, 
      {'role':'assistant', 'content': 'Welcome to NV Pizzaria. How may I help you?'},
      {'role': 'user', 'content': 'What are your most popular items on the menu'},
      {'role':'assistant', 'content': 'The most popular items on our menu are the Cheese Pizza, Veggie Pizza, Pepperoni Pizza, Meat Pizza, Margherita Pizza, BBQ Chicken Pizza, and Hawaiian Pizza.'},
      {'role': 'user', 'content': 'Great! What is the cheapest vegetarian option you have?'},
      {'role':'assistant', 'content': ' The cheapest vegetarian option on our menu is the Classic Margherita Pizza, priced at $12.99.'},
      {'role': 'user', 'content': 'Can I get that?'},
      {'role':'assistant', 'content': " Great! I've added a Classic Margherita Pizza to your order. It will be $12.99. Is there anything else I can assist you with?"},
      {'role': 'user', 'content': 'Yeah do you also offer breadsticks?'},
      {'role':'assistant', 'content': 'No, we do not offer breadsticks at our pizzeria.'},
      {'role': 'user', 'content': 'Can you give me some vegetarian options, preferrable without any onions or garlic?'},
      {'role':'assistant', 'content': 'Yes, we have the Classic Margherita Pizza and the Gluten-Free Margherita Pizza, both of which are vegetarian options without onions or garlic.'},
      // {'role': 'user', 'content': 'Can I get a Gluten Free Pizza. Also make sure there are no onions or garlic on either'},
      // {'role':'assistant', 'content': "Sure, I have updated your order to include a Vegetable Biryani without onions, extra raitha, and spicy. Your total order now consists of Butter Chicken, 1 quantity, Mango Lassi, 1 quantity with extra sweetness, and Vegetable Biryani without onions, extra raitha, and spicy. The total price is $19.48."},
      // {'role': 'user', 'content': 'Sounds good, thank you!'},
      // {'role':'assistant', 'content': "You're welcome! Let me know if you have any questions or if there's anything else I can assist you with."}
    ]
    let order = 'Classic Margherita Pizza, $12.99, 1, no notes.'
    const botResponses = await handleFunctionCall(um, chatHistory, order)
    console.log("BOT RESPONSES", botResponses)

    if(botResponses.length == 1 && botResponses[0].function === 'queryRestaurant'){
        console.log("Response", botResponses[0].response)
    } else{        
        const combinedFunctions = botResponses.map((botResponse)=>{
            if (botResponse.function == 'updateOrder'){
              order = botResponse.response
              console.log("ORDER", order)
            }
            return `${botResponse.function}: ${botResponse.response}`
        }).join('\n')
        const cFCResponse = await combineFunctionCallConversationalRetrievalQAChain.invoke({
            question: `userMessage: ${um}\n` + combinedFunctions,
            chat_history: chatHistory,
        })
        console.log("Response", cFCResponse)
    }
}

await test()

// Start the Express server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
