import express from 'express';
import twilio from 'twilio';
import bodyParser from 'body-parser';
import { config } from "dotenv";
config();
import { handleFunctionCall } from './FunctionCall.js';
import { conversationalRetrievalQAChain } from './ConversationalQAChain.js';
import { combineFunctionCallConversationalRetrievalQAChain } from './OrderCQAChain.js';

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

// Handle incoming calls from Twilio
app.post('/call', twilio.webhook({ validate: false }), async (req, res) => {

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
  
  const response = new twilio.twiml.VoiceResponse();

  const gather = response.gather(
    {
        action: '/process_input', 
        input: "speech", 
        speechTimeout: 1,
        language: 'en-IN',
        profanityFilter: true,
        speechModel: 'phone_call',
        enhanced: true,
        timeout:5,
        method: 'POST',
        hints: "Menu, Order, togo, Classic, Margherita, Ultimate, Veggie, Delight, Spicy, BBQ, Chicken, Mediterranean, Feast, Vegan, Harvest, Supreme, Pepperoni Heaven, Gluten-Free, Hawaiian Luau, Vegan, Pesto, Delight, Meat, Lover's"
    }
  );
  gather.say("Welcome to NV pizzeria. How may I help you?")

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
        const chatHistory = req.session.chatHistory || [];
        const lc_response = await conversationalRetrievalQAChain.invoke({
            question: userMessage,
            chat_history: chatHistory
        })
        console.log(lc_response)

        const botResponses = await handleFunctionCall( userMessage, chatHistory)
        console.log("BOT RESPONSES", botResponses)
          
        if(botResponses.length == 1 && botResponses[0].function === 'queryRestaurant'){
          response.say(botResponses[0].response);
          console.log("Response", botResponses[0].response)

          chatHistory.push({'role':'user', 'content': userMessage}, {'role':'assistant', 'content': botResponses[0].response})
        } else{        
        
          const combinedFunctions = botResponses.map((botResponse)=>{
              return `${botResponse.function}: ${botResponse.response}`
          }).join('\n')
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
                language: 'en-IN',
                profanityFilter: true,
                speechModel: 'phone_call',
                enhanced: true,
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
    const um = 'I would like to order one of those and a Vegetarian Pizza'
    const chatHistory = [
      {'role':'system', 'content':'You are a restaurant worker named Chad. You are speaking on the phone, always answering in the context of your pizzeria. Keep your responses to 2-3 sentences or less.'}, 
      {'role':'assistant', 'content': 'Welcome to NV pizzeria. How may I help you?'},
      {'role': 'user', 'content': 'What are your most popular items on the menu?'},
      {'role':'assistant', 'content': 'The most popular items on our menu are the Cheese Pizza, Veggie Pizza, Pepperoni Pizza, Meat Pizza, Margherita Pizza, BBQ Chicken Pizza, and Hawaiian Pizza'},
      {'role': 'user', 'content': 'Great! How much does the Veggie Pizza Cost?'},
      {'role':'assistant', 'content': 'The Veggie Pizza costs $14.99.'},
      {'role': 'user', 'content': 'Cool, does the Hawaiian Pizza have meat in it? I am vegetarian so I do not eat meat'},
      {'role':'assistant', 'content': "Yes, the Hawaiian Pizza does have meat in it. It contains ham and is topped with pineapple and red onions."},
      // {'role': 'user', 'content': 'I would like to order one of those and a Vegetarian Pizza'},
      // {'role':'assistant', 'content': "Sure, I've added a Mango Lassi to your order and made it extra sweet. Is there anything else I can assist you with?"},
      // {'role': 'user', 'content': 'Can you give me some vegetarian options, preferrable without any onions or garlic?'},
      // {'role':'assistant', 'content': "We have several vegetarian options on our menu that do not contain onions or garlic. Some options include Palak Paneer, Vegetable Biryani, and Plain Paratha."},
      // {'role': 'user', 'content': 'Can I get a Vegetable Biryani without any onions and with extra raitha. Also make it spicy?'},
      // {'role':'assistant', 'content': "Sure, I have updated your order to include a Vegetable Biryani without onions, extra raitha, and spicy. Your total order now consists of Butter Chicken, 1 quantity, Mango Lassi, 1 quantity with extra sweetness, and Vegetable Biryani without onions, extra raitha, and spicy. The total price is $19.48."},
      // {'role': 'user', 'content': 'Sounds good, thank you!'},
      // {'role':'assistant', 'content': "You're welcome! Let me know if you have any questions or if there's anything else I can assist you with."}
  ]
    const botResponses = await handleFunctionCall(um, chatHistory)
    console.log("BOT RESPONSES", botResponses)

    if(botResponses.length == 1 && botResponses[0].function === 'queryRestaurant'){
        console.log("Response", botResponses[0].response)
    } else{        
        const combinedFunctions = botResponses.map((botResponse)=>{
            (botResponse.function === ' updateOrder' ? order = botResponse.response : null)
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
