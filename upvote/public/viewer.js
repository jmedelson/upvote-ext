var token = "";
var tuid = "";
var ebs = "";
var channelId= "";
var voted = [];
var usernameLoaded = 'Jayemochi'
var preLoadedPost = false
var topPosts = [];
var newPosts = [];

// because who wants to type this every time?
var twitch = window.Twitch.ext;

// create the request options for our Twitch API calls
var requests = {
    set: createRequest('POST', 'message'),
    vote: createRequest('POST','vote'),
    remove: createRequest('POST','remove'),
    reset: createRequest('POST','reset')
};

function createRequest(type, method, extended = '') {
    if(extended){
        extended = '/' + extended
    }
    return {
        type: type,
        url: 'https://kdy2tx4lu6.execute-api.us-east-2.amazonaws.com/dev/upvote/' + method + extended,
        success: updateBlock,
        error: logError,
        data:'',
    }
}

function setAuth(token) {
    console.log("TESTING", channelId)
    Object.keys(requests).forEach((req) => {
        twitch.rig.log('Setting auth headers');
        twitch.rig.log('Bearer' + token)
        requests[req].headers = { 'Authorization': 'Bearer ' + token }
    });
}

function updateBlock(res) {
    twitch.rig.log('Success--update block');
    try{
        if(res.identifier == 'initial'){
            var data = res
            for(var post of data.topItem){
                topPosts.push([post.post,post.poster,post.upvotes, post.uid])
            }
            for(post of data.newItem){
                newPosts.push([post.post,post.poster,post.upvotes,post.uid])
            }
            updateDisplay()
        }else{
            twitch.rig.log('non-initial')
        }

    }catch(err){
        twitch.rig.log(err)
    }
    
}

twitch.onContext(function(context) {
    twitch.rig.log(context);
});

twitch.onAuthorized(function(auth) {
    // save our credentials
    token = auth.token;
    tuid = auth.userId;
    channelId = auth.channelId;
    console.log(channelId)
    twitch.rig.log("HELLO WORLD--",channelId)
    if(channelId.length < 3){
        channelId = '79579372'
    }
    requests['get'] = createRequest('GET', 'initial', channelId),
    role = Twitch.ext.viewer.role
    twitch.rig.log("ROLE",role)
    if(role=="broadcaster"){
        $(".reset").show()
    }
    setAuth(token);
    $.ajax(requests.get);
});

function logError(_, error, status) {
  twitch.rig.log('EBS request returned '+status+' ('+error+')');
}
function topSort(){
    topPosts.sort(function(a,b){
        return b[2]-a[2]
    })
    updateDisplay()
}
function newPost(post,poster,identifier = 'placeholder',update = true){
    twitch.rig.log("NEWPOST LENGTH",topPosts.length, newPosts.length)
    if(topPosts.length<15){
        topPosts.push([post,poster,0, identifier])
    }
    newPosts.unshift([post,poster, 0, identifier]);
    if(newPosts.length>15){
        newPosts.pop()
    }
    if(update){
        updateDisplay()
    }
}
function updateDisplay(){
    var hold = ''
    for(var post of topPosts){
        element = '<div class="message"><div class="remove" id="xt'+ post[3] +'">×</div>Post #'+ '12' + '&nbsp;' + post[0]+ '<div class="user"><div class="score" id="tscore'+ post[3] +'">▲'+ post[2] +
        '</div>'+ post[1] +'</div></div>'
        hold += element
        $(".messages-top").html(hold)
    }
    hold = ''
    for(var post of newPosts){
        element = '<div class="message"><div class="remove" id="xn'+ post[3] +'">×</div>Post #'+ '12' + '&nbsp;' + post[0]+ '<div class="user"><div class="score" id="nscore'+ post[3] +'">▲'+ post[2] +
        '</div>'+ post[1] +'</div></div>'
        hold += element
        $(".messages-new").html(hold)
    }
}

$(function() {
    // Local Jquery handlers
    // when we click the cycle button
    $("#post-send").click(function(){
        const message = $("#post-input").val().trim()
        if(message.length > 2){
            $("#post-input").val('')
            var viewerID = Twitch.ext.viewer.id || 'User'
            var id = Math.floor(Math.random()*10000)
            requests.set['data'] = {"post":message, "user":viewerID, 'identifier':id, "name":usernameLoaded };
            $.ajax(requests.set);
            if(usernameLoaded){
                twitch.rig.log("POSTING")
                newPost(message, usernameLoaded)
                preLoadedPost = id
            }
        }
        else{
            twitch.rig.log('message not long enough')
        }
    });
    //also allow sending via enter button
    $('#post-input').keypress(function(event){
        var keycode = (event.keyCode ? event.keyCode : event.which);
        if(keycode == '13'){
            const message = $("#post-input").val().trim()
            if(message.length > 2){
                $("#post-input").val('')
                var viewerID = Twitch.ext.viewer.id || 'User'
                var id = Math.floor(Math.random()*10000)
                requests.set['data'] = {"post":message, "user":viewerID, 'identifier':id, "name":usernameLoaded};
                $.ajax(requests.set);
                if(usernameLoaded){
                    twitch.rig.log("POSTING")
                    newPost(message, usernameLoaded)
                    preLoadedPost = id
                }
            }
            else{
                twitch.rig.log('message not long enough')
            }
        }
    })
    $('.button-top').click(function(){
        var test = $('.button-top').hasClass('selected');
        if(!test){
            $('.button-top').toggleClass('selected')
            $('.button-new').toggleClass('selected')
            $('.messages-top').show()
            $('.messages-new').hide()
        }
    })
    $('.button-new').click(function(){
        var test = $('.button-new').hasClass('selected');
        if(!test){
            $('.button-top').toggleClass('selected')
            $('.button-new').toggleClass('selected')
            $('.messages-new').show()
            $('.messages-top').hide()
        }
    })
    $('#wrapper').on('click', '.score', function(){
        var target = $(this).attr('id')
        target = target.substring(6)
        twitch.rig.log('UPVOTEDDDD',target)
        if(voted.indexOf(target) == -1){
            voted.push(target)
            requests.vote['data'] = {"voteId":target};
            $.ajax(requests.vote);
            for(item of newPosts){
                if(item[3]==target){
                    item[2] = item[2] + 1
                }
            }
            for(item of topPosts){
                if(item[3]==target){
                    item[2] = item[2] + 1
                }
            }
            topSort()
        }
    })
    $('#wrapper').on('click', '.remove', function(){
        var target = $(this).attr('id')
        target = target.substring(2)
        twitch.rig.log('removing',target)
        requests.remove['data'] = {"voteId":target};
        $.ajax(requests.remove);

    })
    $('.reset').click(function(){
        $('.message').hide()
        $.ajax(requests.reset);
    })
    // EBS message handler
    // listen for incoming broadcast message from our EBS
    twitch.listen('broadcast', function (target, contentType, message) {
        twitch.rig.log('Received broadcast',message);
        try{
            data = JSON.parse(message).data
            twitch.rig.log(data)
            if(data.identifier == 'newPost'){
                if(preLoadedPost != data.id){
                    newPost(data.post,data.user,data.unique)
                }
                else{
                    for(item of newPosts){
                        if(item[3] == 'placeholder'){
                            item[3] = data.unique;
                            break;
                        }
                    }
                    for(item of topPosts){
                        if(item[3] == 'placeholder'){
                            item[3] = data.unique;
                            break;
                        }
                    }
                    updateDisplay()
                }
            }
            else if(data.identifier == 'newVote'){
                if(!voted.includes(data.unique)){
                    voted.push(data.unique)
                    for(item of newPosts){
                        if(item[3]==data.unique){
                            item[2] = data.votes
                        }
                    }
                    for(item of topPosts){
                        if(item[3]==data.unique){
                            item[2] = data.votes
                        }
                    }
                    topSort()
                }
            }
            // data = message.split('--')
            // // New post recieved oveer pubsub
            // if(data[0] == 'newPost'){
            //     //post has not been handled
            //     if(preLoadedPost != data[3]){
            //         newPost(data[2],data[1],data[4])
            //     }else{
            //         //post is already displayed
            //         for(item of newPosts){
            //             //replace array placeholder with correct identifier and then rerender
            //             if(item[3] == 'placeholder'){
            //                 item[3] = data[4]
            //                 break;
            //             }
            //         }
            //         for(item of topPosts){
            //             if(item[3] == 'placeholder'){
            //                 item[3] = data[4]
            //                 break;
            //             }
            //         }
            //         updateDisplay()
            //     }
            // }
        }catch(error){
            twitch.rig.log(error)
            console.log(error)
        }
    });
});
