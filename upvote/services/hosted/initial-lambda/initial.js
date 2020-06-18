const AWS = require('aws-sdk');
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-east-2' });

// const queryDB = async (channel) => {
//   var params = {
//     TableName: "upvote-data",
//     Key: {
//       "uid":channel,
//       "time":1592348288771
//       }
//     }
//   await documentClient.get(params, function(err, data){
//     if(err){console.log(err)}else{console.log(data)}
//   }).promise()
// }

const queryDBnew = async (channel) => {
  var newitems = []
  var params = {
    TableName: 'upvote-db',
    IndexName: "channel-time-index",
    KeyConditionExpression: 'channel = :channel',
    ExpressionAttributeValues: {
        ':channel': channel
    },
    Limit: 15,
    ScanIndexForward: false
  }
  const chData = await documentClient.query(params).promise();
  for(var item of chData.Items){
    newitems.push(item)
    console.log(item)
  }
  return newitems
}

const queryDBtop = async (channel) => {
  var topitems = []
  var params = {
    TableName: 'upvote-db',
    IndexName: "channel-upvotes-index",
    KeyConditionExpression: 'channel = :channel',
    ExpressionAttributeValues: {
        ':channel': channel
    },
    Limit: 15,
    ScanIndexForward: false
  }
  const chData = await documentClient.query(params).promise();
  for(var item of chData.Items){
    topitems.push(item)
    console.log(item)
  }
  return topitems
}

const initialHandler = async(channelId) =>{
  var message = {
    topItem:[],
    newItem:[],
    identifier:''
  }
  let[topResult, newResult] = await Promise.all([queryDBtop(channelId),queryDBnew(channelId)]);
  message.topItem = topResult;
  message.newItem = newResult;
  return message
}
exports.handler = async (event) => {
    // TODO implement
    const response = (statusCode, body) => {
      const headers = {
        ['Access-Control-Allow-Origin']: '*',
        ["Access-Control-Allow-Credentials"] : true
      };
  
      return { statusCode, body:JSON.stringify(body, null, 2), headers };
    };
    var channel = event.pathParameters.proxy
    var res = await initialHandler(channel)
    res.identifier = 'initial'
    console.log(event.pathParameters.proxy)
    return response(200, res);
};
