require('dotenv').config()
import cron from 'node-cron'
import { execute, makePromise } from 'apollo-link'
import fetch from 'node-fetch';
import {HttpLink} from 'apollo-link-http';
import gql from 'graphql-tag'
var admin = require('firebase-admin')
const moment = require('moment')

admin.initializeApp({
  credential: admin.credential.cert(process.env.SERVICE_ACCOUNT),
  databaseURL: process.env.DATABASE_URL
})

const uri = process.env.GRAPHQL_SERVER

const link = new HttpLink({
  uri,
  fetch
});

const currentMinute = new Date()
const currentMinute1 = currentMinute
currentMinute1.setMinutes(currentMinute1.getMinutes() + 1)

const noAnswerQuery = gql`
query {
  questions(where:{AND:[
  {sentTo:{pushToken_not:null}},{expirationTime:null}]}){
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

const sentNotifications =  gql`
  mutation SentNotifications($sentDate: DateTime!,
      $expirationTime: DateTime!,
      $questionId: ID!){
    notificationSent(sentDate:$sentDate,
      expirationTime: $expirationTime,
      id: $questionId){
        id
        expirationTime
        sentDate
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
              course: item.test.course.name,
              institution: item.test.course.institution.name,
              testNumber: item.test.testNumber,
              subject: item.test.subject
            },
            token: item.sentTo.pushToken
          };

          console.log(JSON.stringify(message))

          admin.messaging().send(message)
          .then((response) => {
            // Response is a message ID string.
           console.log('Successfully sent message:', response);
          })
          .catch((error) => {
            console.log('Error sending message:', error);
          });


        const sentDate = moment().format()

        const expirationTime = moment().add(1, 'hour').format()

          const operation1 = {
            query: sentNotifications,
            variables: {
              questionId: item.id,
              sentDate: sentDate,
              expirationTime: expirationTime
            } //optional
          };

          makePromise(execute(link, operation1))
           .then(resp => {
              const update = resp.data.notificationSent
              console.log(update.expirationTime, update.sentDate)
            })
           .catch(error => console.log(`received error ${error}`))

    })
    console.log('all notes pushed')
})
.catch(error => console.log(`received error ${error}`))

})
