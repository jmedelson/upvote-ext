var token = "";
var tuid = "";
var ebs = "";
var role = "";
var channelId= "";
var voted = [];
var usernameLoaded = false
var preLoadedPost = false
var topPosts = [];
var newPosts = [];

// because who wants to type this every time?
var twitch = window.Twitch.ext;

// create the request options for our Twitch API calls
var requests = {
    set: createRequest('POST', 'message'),
    vote: createRequest('POST','vote'),
    remove: createRequest('DELETE','remove'),
    reset: createRequest('DELETE','reset')
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
    twitch.rig.log(res)
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
        }else if(res.identifier == 'username'){
            usernameLoaded = res.payload
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
    role = Twitch.ext.viewer.role
    console.log(channelId)
    twitch.rig.log("HELLO WORLD--",channelId)
    if(tuid.startsWith('U')){
        if(!Twitch.ext.viewer.isLinked){
            console.log("Requesting id share")
            Twitch.ext.actions.requestIdShare()
        }else{
            console.log("ID already shared")
            $("#post-input").prop("disabled", false );
            var element2 = document.getElementById("post-send")
            element2.style.color = 'white'
            element2.style.background = 'none'
            element2.style.pointerEvents = 'auto'
        }
    }else{
        console.log("ID share not requested") 
    }
    requests['get'] = createRequest('GET', 'initial', channelId),
    twitch.rig.log("ROLE",role)
    if(role=="broadcaster"){
        $(".reset").show()
    }
    setAuth(token);
    $.ajax(requests.get);
});

function logError(_, error, status) {
  twitch.rig.log('EBS request returned '+status+' ('+error+')');
  console.log(error,'---',status)
}
function removeHandler(postId){
    twitch.rig.log(postId)
    for(var post in newPosts){
        if(newPosts[post][3] == postId){
            newPosts.splice(post,1)
            break;
        }
    }
    for(var post in topPosts){
        if(topPosts[post][3] == postId){
            topPosts.splice(post,1)
            var pointer = newPosts.length-1
            var pointer2 = topPosts.length-1
            while(pointer >= 0){
                var found = false
                pointer2 = topPosts.length-1
                while(pointer2 >= 0){
                    if(topPosts[pointer2][3] == newPosts[pointer][3]){
                        found = true
                        pointer2= -1
                    }
                    pointer2 = pointer2-1
                }
                twitch.rig.log("CHECK -------", pointer, found)
                if(!found){
                    topPosts.push(newPosts[pointer])
                    pointer= -1
                }
                pointer = pointer - 1
            }
            break;
        }
    }
    updateDisplay()
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
        element = '<div class="message"><div class="remove" id="xt'+ post[3] +'">×</div><div class="post-message">' + decodeURIComponent(post[0])+ '</div><div class="user"><div class="score" id="tscore'+ post[3] +'">▲'+ post[2] +
        '</div>'+ post[1] +'</div></div>'
        hold += element
        $(".messages-top").html(hold)
    }
    hold = ''
    for(var post of newPosts){
        element = '<div class="message"><div class="remove" id="xn'+ post[3] +'">×</div><div class="post-message">' + decodeURIComponent(post[0])+ '</div><div class="user"><div class="score" id="nscore'+ post[3] +'">▲'+ post[2] +
        '</div>'+ post[1] +'</div></div>'
        hold += element
        $(".messages-new").html(hold)
    }
    if(role == 'broadcaster'){
        $('.remove').css( "display", "inline-block" )
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
            var element = document.getElementById("post-input");
            var element2 = document.getElementById("post-send")
            element.disabled = true
            element2.style.color = '#2036ff'
            element2.style.background = 'white'
            element2.style.pointerEvents = 'none'
            setTimeout(function(){  
                element.disabled = false;
                element2.style.color = 'white'
                element2.style.background = 'none'
                element2.style.pointerEvents = 'auto'
            }, 60000);
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
                var element = document.getElementById("post-input");
                var element2 = document.getElementById("post-send")
                element.disabled = true
                element2.style.color = '#2036ff'
                element2.style.background = 'white'
                element2.style.pointerEvents = 'none'
                setTimeout(function(){  
                    element.disabled = false;
                    element2.style.color = 'white'
                    element2.style.background = 'none'
                    element2.style.pointerEvents = 'auto'
                }, 60000);
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
            voted.push(target)
            requests.vote['data'] = {"voteId":target};
            $.ajax(requests.vote);
            var hold
            for(item of newPosts){
                if(item[3]==target){
                    item[2] = item[2] + 1
                    hold = item
                }
            }
            var found = false
            for(item of topPosts){
                if(item[3]==target){
                    item[2] = item[2] + 1
                    found = true
                }
            }
            if(!found){
                if(topPosts[topPosts.length-1][2]<hold[2]){
                    topPosts.pop()
                    topPosts.push(hold)
                }
            }
            topSort()
        }
    })
    $('#wrapper').on('click', '.remove', function(){
        var target = $(this).attr('id')
        target = target.substring(2)
        twitch.rig.log('removing',target)
        requests.remove['data'] = {"uid":target};
        $.ajax(requests.remove);

    })
    $('.reset').click(function(){
        // $('.message').hide()
        requests.reset['data'] = {"started":'false'};
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
            }else if(data.identifier == 'newVote'){
                twitch.rig.log("Vote updating")
                if(!voted.includes(data.uid)){
                    voted.push(data.post)
                    for(item of newPosts){
                        if(item[3]==data.uid){
                            item[2] = data.votes
                        }
                    }
                    var found = false
                    for(item of topPosts){
                        if(item[3]==data.uid){
                            item[2] = data.votes
                            found = true
                        }
                    }
                    if(!found){
                        if(topPosts[topPosts.length-1][2]<data.votes){
                            topPosts.pop()
                            topPosts.push([data.post,data.poster, data.votes, data.uid])
                        }
                    }
                    topSort()
                }
            }else if(data.identifier == 'removePost'){
                removeHandler(data.uid)
            }else if(data.identifier == 'resetStart'){
                twitch.rig.log("RESET STARTING")
                $(".messages-new").html('')
                $(".messages-top").html('')
                topPosts = []
                newPosts = []
                var element = document.getElementById("post-input");
                var element2 = document.getElementById("post-send")
                element.disabled = true
                element2.style.color = '#2036ff'
                element2.style.background = 'white'
                element2.style.pointerEvents = 'none'
            }else if(data.identifier == 'resetNotDone'){
                twitch.rig.log("RESET NOT DONE, RESENDING REQUEST")
                if(role=="broadcaster"){
                    requests.reset['data'] = {"started":'true'};
                    $.ajax(requests.reset);
                }
            }else if(data.identifier == 'resetComplete'){
                twitch.rig.log("RESET COMPLETE")
                var element = document.getElementById("post-input");
                var element2 = document.getElementById("post-send")
                element.disabled = false;
                element2.style.color = 'white'
                element2.style.background = 'none'
                element2.style.pointerEvents = 'auto'
            }
        }catch(error){
            twitch.rig.log(error)
            console.log(error)
        }
    });
});
