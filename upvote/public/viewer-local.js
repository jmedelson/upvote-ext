var token = "";
var tuid = "";
var ebs = "";
var voted = [];

// because who wants to type this every time?
var twitch = window.Twitch.ext;

// create the request options for our Twitch API calls
var requests = {
    set: createRequest('POST', 'message'),
    get: createRequest('GET', 'initial'),
    vote: createRequest('POST','upvote'),
    remove: createRequest('POST','remove'),
    reset: createRequest('POST','reset')
};

function createRequest(type, method) {

    return {
        type: type,
        url: location.protocol + '//localhost:8081/upvote/' + method,
        success: updateBlock,
        error: logError,
        data:'',
    }
}

function setAuth(token) {
    Object.keys(requests).forEach((req) => {
        twitch.rig.log('Setting auth headers');
        requests[req].headers = { 'Authorization': 'Bearer ' + token }
    });
}
function populate(dataTop, dataNew){
    $(".message").remove();
    role = Twitch.ext.viewer.role
    var hold = ''
    if(role == "broadcaster"){
        for(item in dataTop){
            element = '<div class="message"><div class="remove" id="xt'+ dataTop[item].id+'">×</div>Post #'+ dataTop[item].id + '&nbsp;' + dataTop[item].post+ '<div class="user"><div class="score" id="t'+ dataTop[item].id +'">▲'+ dataTop[item].votes +
            '</div>'+ dataTop[item].user +'</div></div>'
            // twitch.rig.log(element)
            hold += element
        }
        $(".messages-top").append(hold)
        hold = ''
        for(item in dataNew){
            element = '<div class="message"><div class="remove" id="xn'+ dataNew[item].id+'">×</div>Post #'+ dataNew[item].id +'&nbsp;' + dataNew[item].post+ '<div class="user"><div class="score" id="n'+ dataNew[item].id +'">▲'+ dataNew[item].votes +
            '</div>'+ dataNew[item].user +'</div></div>'
            // twitch.rig.log(element)
            hold += element
        }
        $(".messages-new").append(hold)
    }
    else{
        for(item in dataTop){
            element = '<div class="message">Post #'+ dataTop[item].id + '&nbsp;' + dataTop[item].post+ '<div class="user"><div class="score" id="t'+ dataTop[item].id +'">▲'+ dataTop[item].votes +
            '</div>'+ dataTop[item].user +'</div></div>'
            // twitch.rig.log(element)
            hold += element
        }
        $(".messages-top").append(hold)
        hold = ''
        for(item in dataNew){
            element = '<div class="message">Post #'+ dataNew[item].id +'&nbsp;' + dataNew[item].post+ '<div class="user"><div class="score" id="n'+ dataNew[item].id +'">▲'+ dataNew[item].votes +
            '</div>'+ dataNew[item].user +'</div></div>'
            // twitch.rig.log(element)
            hold += element
        }
        $(".messages-new").append(hold)
    }

}
function updateBlock(res) {
    twitch.rig.log('Success--update block');
    if(res != "N/A"){
        data = res.split('--');
        twitch.rig.log('data',typeof(data[0]))

        // twitch.rig.log('data2',typeof(JSON.parse(data[0])))
        var dTop = JSON.parse(data[0])
        var dNew = JSON.parse(data[1])
        twitch.rig.log('tops', dTop)
        populate(dTop, dNew)
    }
    
}

twitch.onContext(function(context) {
    twitch.rig.log(context);
});

twitch.onAuthorized(function(auth) {
    // save our credentials
    token = auth.token;
    tuid = auth.userId;
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


$(function() {
    // Local Jquery handlers
    // when we click the cycle button
    $("#post-send").click(function(){
        const message = $("#post-input").val().trim()
        if(message.length > 2){
            $("#post-input").val('')
            var name = Twitch.ext.viewer.id || 'User'
            requests.set['data'] = {"post":message, "user":name};
            $.ajax(requests.set);
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
                var name = Twitch.ext.viewer.id || 'User'
                requests.set['data'] = {"post":message, "user":name};
                $.ajax(requests.set);
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
        target = target.substring(1)
        twitch.rig.log('UPVOTEDDDD',target)
        if(voted.indexOf(target) == -1){
            voted.push(target)
            requests.vote['data'] = {"voteId":target};
            $.ajax(requests.vote);
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
        if(message=='reset'){
            $('.message').remove()
        }
        else{
            data = message.split('--')
            if(data[0].length > 0){
                dataTop = JSON.parse(data[0])
                dataNew = JSON.parse(data[1])
                twitch.rig.log("!!!!!", dataTop, dataNew)
                populate(dataTop, dataNew)
            }
        }
    });
});
