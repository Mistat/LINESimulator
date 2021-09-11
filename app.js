// Dependencies.
var express = require('express');
var path = require('path');
var bodyParser = require("body-parser");
var fs = require('fs');
var request = require('request');
var faker = require('faker');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var crypto = require('crypto');
var botAPIAddress;
var channelSecret;
var channelToken;
var userRichMenuId = null

// Specifie body parsers
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
app.use(bodyParser.raw({ limit: '50mb', type: '*/*' }));
// Return all static files such as css and js in public folder.
app.use(express.static(__dirname + '/public'))

/* Routing  */
// For root, return the emulator
app.get('/', function (req, res) {
    res.sendFile(__dirname + "/simulator.html");
});
const lineAPIUrl = "https://api.line.me/v2/";

// Set channelSettings.
app.post('/channelSettings', function (req, res) {
    botAPIAddress = req.body.botAPIAddress;
    channelSecret = req.body.channelSecret;
    channelToken = req.body.channelToken;
    res.send({});
});

// Receive file from client and send appropriate event to API.
app.post('/upload', function (req, res) {
    console.log(`${req.method} ${req.url}`);
    // Generate contentId by using time and copy the file into upload folder.
    var contentId = Date.now().toString();
    if (!fs.existsSync(path.join(__dirname, 'public', 'temp'))) {
        fs.mkdirSync(path.resolve(__dirname, 'public', 'temp'));
    }
    if (!fs.existsSync(path.join(__dirname, 'public', 'temp', contentId))) {
        fs.mkdirSync(path.resolve(__dirname, 'public', 'temp', contentId));
    }
    // Create message depending on file type (extension)
    var splitFileName = req.body.filename.split('\\');
    var filename = splitFileName[splitFileName.length - 1];
    var filePath = path.join('temp', contentId, filename);
    var fileFullPath = path.join(__dirname, 'public', 'temp', contentId, filename);
    if (req.body.base64string) {
        fs.writeFileSync(fileFullPath, new Buffer(req.body.base64string.split(',')[1], 'base64'));
    } else {
        fs.copyFileSync(req.body.filename,
            fileFullPath);
    }
    var fileext = filename.split('.')[1].toLowerCase();
    console.log(`fileext: ${fileext}`);
    var type = "file"
    if (fileext === "mp4") {
        type = "video";
    }
    else if (fileext === "png" || fileext === "jpeg" || fileext === "jpg") {
        type = "image";
    }
    else if (fileext === "m4a") {
        type = "audio"
    }
    var sendObject = {
        "replyToken": "nHuyWiB7yP5Zw52FIkcQobQuGDXCTA",
        "type": "message",
        "timestamp": 1462629479859,
        "source": {
            "type": "user",
            "userId": req.body.userId
        },
        "message": {
            "id": contentId,
            "type": type
        }
    };

    var jsonData = JSON.stringify({ "events": [sendObject] });
    var signature = crypto.createHmac("SHA256", channelSecret)
        .update(jsonData)
        .digest().toString('base64');
    console.log(jsonData);
    // Send request.
    request({
        headers: {
            "X-Line-Signature": signature,
            "Content-Type": "application/json"
        },
        uri: botAPIAddress,
        body: jsonData,
        method: 'POST'
    },
        function (error, response, body) {
            // handle result if necessary.
        }
    );

    res.send({ "filePath": filePath, "sendObject": sendObject });
});

/* send request to your bot application */
app.post('/send', function (req, res) {
    console.log('send');
    var jsonData = JSON.stringify(req.body);
    // Generate hash based on https://developers.line.me/en/docs/messaging-api/reference/#signature-validation
    console.log(channelSecret)
    console.log(jsonData)
    var signature = crypto.createHmac("SHA256", channelSecret)
        .update(jsonData)
        .digest().toString('base64');

    request(
        {
            headers: {
                "X-Line-Signature": signature,
                "Content-Type": "application/json"
            },
            uri: botAPIAddress,
            body: jsonData,
            method: 'POST'
        },
        function (error, response, body) {
            res.sendStatus(response.statusCode);
        }
    );
});


// ユーザーのリッチメニューのIDを取得する
// https://developers.line.biz/ja/reference/messaging-api/#get-rich-menu-id-of-user
app.get('/bot/user/:userId/richmenu', (req, res)=>{
    console.log(`Richmenu :${req.params.userId} ${userRichMenuId}`);
    res.send(
        userRichMenuId ? {"richMenuId":userRichMenuId} : {})
});

// リッチメニューとユーザーをリンクする
// https://developers.line.biz/ja/reference/messaging-api/#link-rich-menu-to-user
app.post('/bot/user/:userId/richmenu/:richMenuId', (req, res) => {
    userRichMenuId = req.params.richMenuId;
    console.log(`Link:${req.params.userId} ${req.params.richMenuId}`);
    res.send({})
});

// リッチメニューとユーザーのリンクを解除する
// https://developers.line.biz/ja/reference/messaging-api/#unlink-rich-menu-from-user
app.delete('/bot/user/:userId/richmenu', (req, res) => {
    userRichMenuId = null;
    console.log(`Unlink:${req.params.userId}`);
    res.send({})
});

app.get('/bot/user/:userId/richmenu', (req, res) => {
    console.log(`Unlink:${req.params.userId} ${userRichMenuId}`);
    res.send({"richMenuId":userRichMenuId})
});

// 友だち数を取得する
// https://developers.line.biz/ja/reference/messaging-api/#get-number-of-followers
app.get('/bot/insight/followers', (req, res) => {
    res.send({
        status: 'ready',
        followers: 32524,
        targetedReaches: 19935,
        blocks: 12179
    })
});

// 当月のメッセージ利用状況を取得する
// https://developers.line.biz/ja/reference/messaging-api/#get-consumption
app.get('/bot/message/quota/consumption', (req, res) => {
    res.send( { totalUsage: 90904 })
});

// 追加メッセージ数の上限目安を取得する
// https://developers.line.biz/ja/reference/messaging-api/#get-quota
app.get('/bot/message/quota', (req, res) => {
    res.send({ type: 'limited', value: 335000 })
});

// プロフィール情報を取得する
// https://developers.line.biz/ja/reference/messaging-api/#get-profile
app.get('/bot/profile/:userId', (req, res) => {
    res.send({
        "displayName": faker.internet.userName(),
        "userId":req.params.userId,
        "language":"js",
        "pictureUrl":faker.image.imageUrl(),
        "statusMessage": faker.lorem.text()
    });
});

// Receive request from your bot application.
app.all('/*', function (req, res) {
    console.log(`${req.method}: ${req.url}`);

    var url = req.url;
    // reply, push and multicast will be simply pass to UI.
    if (url.indexOf('reply') > -1 || url.indexOf('push') > -1 || url.indexOf('multicast') > -1) {
        io.emit('reply', req.body);
        res.status(200).send({});
    }

    else if (url.indexOf('content') > -1 && req.method.toLowerCase() == 'get') {
        // The actual file sit in public\temp. Returns the file with messageId
        let messageId = url.slice(url.indexOf('message') + 8, url.indexOf('content') - 1);
        var files = fs.readdirSync(path.join(__dirname, 'public', 'temp', messageId));
        res.sendFile(path.join(__dirname, 'public', 'temp', messageId, files[0]));
    }
});

//#endregion
/* Start the service */
http.listen(8080, function () {
    console.log('listening on *:8080');
});
