const AWS = require('aws-sdk');
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-east-2' });



const queryDB2 = async (channel) => {
  var items = []
  var params = {
    TableName: 'upvote-data',
    KeyConditionExpression: 'uid = :channel',
    ExpressionAttributeValues: {
        ':channel': channel
    },
    Limit: 10,
    ScanIndexForward: false
  }
  const chData = await documentClient.query(params).promise();
  for(var item of chData.Items){
    console.log(item)
  }
  return chData.length
}

const queryDB = async (channel) => {
  var items = []
  var params = {
    TableName: 'upvote-data',
    IndexName: "upvote-index",
    KeyConditionExpression: 'uid = :channel',
    ExpressionAttributeValues: {
        ':channel': channel
    },
    Limit: 10,
    ScanIndexForward: false
  }
  const chData = await documentClient.query(params).promise();
  for(var item of chData.Items){
    console.log(item)
  }
  return chData.length
}

const initialHandler = async(channelId) =>{
  await queryDB(channelId)
  return;
}
exports.handler = async (event) => {
    // TODO implement
    const response = (statusCode, body) => {
      const headers = {
        ['Access-Control-Allow-Origin']: '*',
        ["Access-Control-Allow-Credentials"] : true
      };
  
      return { statusCode, body: JSON.stringify(body, null, 2), headers };
    };
    var channel = event.pathParameters.proxy
    await initialHandler(channel)
    console.log(event.pathParameters.proxy)
    return response(200, 'INITIAL message--sucess');
};
