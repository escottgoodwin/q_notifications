require('dotenv').config()
import cron from 'node-cron'
import { execute, makePromise } from 'apollo-link'
import fetch from 'node-fetch';
import {HttpLink} from 'apollo-link-http';
import gql from 'graphql-tag'

var registrationToken = 'YOUR_REGISTRATION_TOKEN';
//const uri = 'http://localhost:4000/';
const uri = process.env.GRAPHQL_SERVER
console.log(uri)
const link = new HttpLink({
  uri,
  fetch
});

const currentMinute = new Date()
const currentMinute1 = currentMinute
currentMinute1.setMinutes(currentMinute1.getMinutes() + 1)

const noAnswerQuery = gql`
query {
  questions(where:{AND:[{questionAnswers_every:{id:""}},
  {sentTo:{pushToken_not:null}}]}){
    count
    questions{
      id
      question
      questionAnswers{
        id
      }
      test{
        id
        subject
        testNumber
        course{
          name
          institution{
            name
          }
        }
      }
      sentTo{
        id
        pushToken
        firstName
        lastName
        email
      }
    }
  }
}
`

const operation = {
  query: noAnswerQuery,
  variables: {} //optional
};

console.log('running now');

cron.schedule('* * * * *', () => {

  console.log('running a task every minute');

// select expiring question for current minute

  makePromise(execute(link, operation))
    .then(resp => {

      console.log(resp.data.questions.count)

      resp.data.questions.questions.forEach(item => {
          const pushMessage = `Please answer a new question for ${item.test.testNumber} - ${item.test.subject}.`

      const message = {
        notification:{
          body:pushMessage,
          title:`${item.test.course.name} - ${item.test.course.institution.name}`,
        },
        data: {
          questionId: item.id,
        },
        token: item.sentTo.pushToken
      };

      console.log(JSON.stringify(message))

      //admin.messaging().send(message)
      //.then((response) => {
        // Response is a message ID string.
      //  console.log('Successfully sent message:', response);
      //})
    //  .catch((error) => {
      //  console.log('Error sending message:', error);
      //});

    })
})
.catch(error => console.log(`received error ${error}`))

})
