const CDP = require('chrome-remote-interface');
const fs = require('fs');

var HashSet = require('hashset');
var HashMap = require('hashmap');
const parseDomain = require("parse-domain");


var hashset = new HashSet();

async function readDomains(){
    var readline = require('readline');

    var rd = readline.createInterface({
        input: fs.createReadStream('adserverdomains.txt'),
        output: process.stdout,
        console: true
    });

    rd.on('line', function(line) {
        //console.log(line);
        if(line.indexOf('#')==-1)
        {
            domain = line.substr(10);
            //console.log(domain);
            hashset.add(domain);
        }
    });
};

async function readVideoURLs(){
    var vURLs = [];
    var readline = require('readline');

    var rd = readline.createInterface({
        input: fs.createReadStream('video_urls.txt'),
        output: process.stdout,
        console: true
    });

    rd.on('line', function(line) {
        //console.log(line);
        vURLs.push(line);
    });
    return vURLs;
};

async function analyze(vURL) {
    console.log('Parsing: '+vURL);
    let client;
    const viewportWidth = 800;
    let videoPlayers = [];
    let videoPlayersData = [];
    try {
        // connect to endpoint
        client = await CDP();
        // extract domains
        const {Network, Page, DOM, Runtime, Emulation} = client;
        let model = {};

        var videoContentLength = 0; //length of video content for each video URL

        // enable events then start!
        await Network.enable();
        await Page.enable();
        await Page.navigate({url: vURL});
        await Page.loadEventFired(async () => {
            // measure the height of the rendered page and use Emulation.setVisibleSize
            const {root: {nodeId: documentNodeId}} = await DOM.getDocument();
            const {nodeId: bodyNodeId} = await DOM.querySelector({
                selector: 'body',
                nodeId: documentNodeId,
            });
            model = await DOM.getBoxModel({nodeId: bodyNodeId});
            console.log('Analyzing..');
            await client.on('Network.responseReceived', async (e) => {
                let responseData =  await analyzeResponse(e, DOM, Emulation, Page, model.model);
                if(responseData){
                    for(ki = 0; ki<responseData.videos.length; ki++){
                        let domExists = false;
                        for(ji = 0; ji<videoPlayers.length; ji++){
                            if(videoPlayers[ji].nodeId == responseData.videos[ki].nodeId && videoPlayers[ji].src == responseData.videos[ki].src){
                                domExists = true;
                            }
                        }
                        if(!domExists){
                            videoPlayers.push(responseData.videos[ki]);
                            let videoPlayerData = {};
                            videoPlayerData.video = responseData.videos[ki];
                            videoPlayerData.hasContent = responseData.hasContent;
                            videoPlayersData.push(videoPlayerData);
                        }
                    }
                    //videoPlayers.push(responseData);
                }
                /*if(responseData.hasAnyVideo)
                hasAnyVideo = responseData.hasAnyVideo;
                if(responseData.hasContent)
                    hasContent = responseData.hasContent;
                if(responseData.hasInBannerVideo)
                    hasInBannerVideo = responseData.hasInBannerVideo;*/

            });
            console.log('After Analyzing..');
        });
        /*let { searchId, resultCount } = await DOM.performSearch({ query: ".//video" });
        if(resultCount > 0){
            let { nodeIds } = await DOM.getSearchResults({
                searchId,
                fromIndex: 0,
                toIndex: resultCount
            });
            for(var i=0; i<nodeIds.length; i++){
                let vAttributes = await DOM.getAttributes({ nodeId: nodeIds[i] });
                let attrIndex = 0;
                let videoTagAttributes = null;
                let autoplay = false;
                // get the src of html video tag that is rendered, get the dimensions to find out if it is in-banner video
                console.log(vAttributes);
                for(var j =0; j<vAttributes.attributes.length; j++) {
                    //vAttributes.attributes.forEach(async attr => {
                    if (vAttributes.attributes[j] == 'autoplay') {
                        autoplay = true;
                    }
                }
                if(autoplay == false){
                    let videoJSObject = DOM.resolveNode({nodeId: nodeIds[i]});
                    console.log(videoJSObject.objectId);
                }
            }
        }*/

        await sleep(Page, 60000);
        //if(!hasAnyVideo){
        await Runtime.evaluate({
            expression: `window.scroll(0,${model.model.height})`
        });
        console.log('scrolling to '+model.model.height);
        //}
        await sleep(Page, 60000);
        await Runtime.evaluate({
            expression: `window.scroll(0,${model.model.height*2})`
        });
        await sleep(Page, 60000);
        /*let layout = await Page.getLayoutMetrics();
        console.log(layout);
        while(!hasAnyVideo && layout.layoutViewport.pageY < (layout.contentSize.height))
        {
          layout = await Page.getLayoutMetrics();
          console.log(layout);
          let viewPort = {};
          viewPort.x = layout.layoutViewport.pageX;
          let py = layout.layoutViewport.pageY + layout.layoutViewport.clientHeight;
          console.log('py '+py);
          viewPort.y = py;
          viewPort.width = layout.layoutViewport.clientWidth;
          viewPort.height = layout.layoutViewport.clientHeight;
          viewPort.scale = 1;
          viewPort.zoom = 1;

          let deviceMetrics = {
            width: 0,
            height: 0,
            deviceScaleFactor: 0,
            mobile: false,
            viewport: viewPort
          };
          Page.setDeviceMetricsOverride(deviceMetrics);
          await sleep(Page, 30000);
        }*/
        console.log('vidoe players');
        //console.log(videoPlayers);
        let hasContent = false;
        let hasInBannerVideo = false;
        let hasAnyVideo = false;
        let hasInstreamPlayer = false;
        let nodeMap = new HashMap();
        console.log(videoPlayersData);
        hasAnyVideo = videoPlayersData && videoPlayersData.length > 0;
        for(k = 0; k<videoPlayersData.length; k++){
            if(videoPlayersData[k].hasContent)
                hasContent = true;
            if(videoPlayersData[k].video.hasInBannerVideo){
                hasInBannerVideo = true;
            }
            let videoNode = nodeMap.get(videoPlayersData[k].video.nodeID);
            if(videoNode){
                if(!videoNode.hasContent && videoPlayersData[k].hasContent)
                    hasInstreamPlayer = true;
            }
            nodeMap.set(videoPlayersData[k].video.nodeID, videoPlayersData[k]);
        }

        console.log("Results of "+vURL);
        console.log("This page has content : "+hasContent);
        console.log("This page has InBanner Video : "+hasInBannerVideo);
        console.log("This page has any video : "+ hasAnyVideo);
        console.log("This page has  instream video "+hasInstreamPlayer);

        /*const {data} = await Page.captureScreenshot();
        fs.writeFileSync('scrot.png', Buffer.from(data, 'base64'));*/
    } catch (err) {
        console.error(err);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

async function analyzeResponse(e, DOM, Emulation, Page, model) {
    let videoURLs = [];
    let pageURL = new URL(e.response.url);
    let responseData = null;

    var parsedDomain = parseDomain(e.response.url);
    if(e.response.url.includes("blob:"))
    {
        //console.log(e.response.url.substr("blob:"));
        parsedDomain = parseDomain(e.response.url.substr(5));
        //console.log(parsedDomain);
    }

    // for URLS with MIME type video/*
    if(parsedDomain != null && (e.response.mimeType.includes("video"))){
        //console.log(e.response.url);
        responseData = {};
        responseData.hasContent = true;
        //console.log(parsedDomain);
        responseData.hasAnyVideo = true;
        let contentType;
        if(hashset.contains(parsedDomain.domain + '.' + parsedDomain.tld) || hashset.contains(pageURL.hostname)) //check if top level domain is in list of ad server domains
        {
            responseData.hasContent = false;
        }
        /*if(){ //check if entire hostname (including subdomain) is in list of ad server domains
            responseData.hasContent = false;
        }*/

        //console.log(e.response.url + ' HAS CONTENT '+responseData.hasContent);

        //get Content Type
        contentType = getContentType(e.response.headers);

        //get Content Length
        if(e.response.headers['Content-Length'])
        {
            if(videoURLs.indexOf(e.response.url)>-1){
                videoContentLength = videoContentLength + parseInt(e.response.headers['Content-Length']);
            }
            else
                videoContentLength = parseInt(e.response.headers['Content-Length']);
        }


        //console.log('Video Content Length '+videoContentLength);
        videoURLs.push(e.response.url);
        //console.log('original video urls');
        //console.log(videoURLs);
        let domData = null;
        //if(e.response.url.includes("blob:")){
            domData = await getVideoDom(DOM, e.response.url, Emulation, Page, model);
        //}
        //console.log('dom data');
        //console.log(domData);
        responseData.videos = domData;

        //if content type of video URL is streaming, it indicates real content, not an ad.
        if(contentType && contentType.toLowerCase().includes('mp2t'))
        {
            //console.log('Content URL '+e.response.url);
            responseData.hasContent = true;
        }

        // if content type is MP4 and content size > 5MB, its an indication of real content.
        /*if(contentType && contentType.toLowerCase().includes('mp4'))
        {
            console.log('content length '+(videoContentLength/(1000*1000))+' MB');
            if((videoContentLength/(1000*1000)) >= 5)
                responseData.hasContent = true;
        }*/
        /*if(domData.hasInBannerVideo){
            responseData.hasInBannerVideo = true;
        }*/
    }
    return responseData;
}

function getContentType(headers){
    if(headers['Content-Type'])
    {
        contentType = headers['Content-Type'];
    }
    if(headers['content-type'])
    {
        contentType = headers['content-type'];
    }
}

async function getVideoDom(DOM, videoURL, Emulation, Page, model){
    let { searchId, resultCount } = await DOM.performSearch({ query: ".//video" });
    //console.log('video ID '+searchId);
    let { nodeIds } = await DOM.getSearchResults({
        searchId,
        fromIndex: 0,
        toIndex: resultCount
    });
    //console.log(nodeIds);
    let domData = {hasInBannerVideo: false};
    let videoPlayers = [];
    /*nodeIds.forEach(async id => {
        // This will fail without DOM.getDocument
        //console.log(await DOM.getAttributes({ nodeId: id }));
        //let { vAttributes } = await DOM.getAttributes({ nodeId: id });
        //console.log(await DOM.getOuterHTML({nodeId: id}));
        domData = await matchVideoDom(id, DOM, videoURLs);
        if(domData){
            videoPlayers.push(domData);
        }
        console.log('video players '+videoPlayers);
        /!*if(videoTagAttributes.hasInBannerVideo)
          domData.hasInBannerVideo = true;*!/
    })*/
    for(var i=0; i<nodeIds.length; i++){
        domData = await matchVideoDom(nodeIds[i], DOM, videoURL);
        if(domData){
            videoPlayers.push(domData);
            break;
            //await captureVideoScreenshot(Page, Emulation, model);
        }
        //console.log('video players ')
        //console.log(videoPlayers);
    }

    return videoPlayers;
}

function play(){
    this.play();
    return 'result';
}

async function matchVideoDom(nodeId, DOM, videoURL){
    let vAttributes = await DOM.getAttributes({ nodeId: nodeId });
    let attrIndex = 0;
    let videoTagAttributes = null;
        // get the src of html video tag that is rendered, get the dimensions to find out if it is in-banner video
    //console.log(vAttributes);
    for(var j =0; j<vAttributes.attributes.length; j++) {
        //vAttributes.attributes.forEach(async attr => {
        let autoplay = false;
        let hasInBannerVideo = false;
        if (vAttributes.attributes[j] == 'autoplay') {
            autoplay = true;
        }
        if (vAttributes.attributes[j] == 'src') {
            if((videoURL == vAttributes.attributes[attrIndex + 1])||(vAttributes.attributes[attrIndex + 1]).includes("blob:")) {
            //if ((videoURLs.indexOf(vAttributes.attributes[attrIndex + 1]) > -1) || (vAttributes.attributes[attrIndex + 1]).includes("blob:")) {
                //console.log('passed video urls');
                //console.log(videoURLs);
                videoTagAttributes = {};
                let boxModel = await DOM.getBoxModel({nodeId: nodeId});
                let quads = await DOM.getContentQuads({nodeId: nodeId});
                //console.log(quads);
                videoTagAttributes.nodeId = nodeId;
                videoTagAttributes.src = vAttributes.attributes[attrIndex + 1];
                videoTagAttributes.boxmodel = boxModel;
                videoTagAttributes.quads = quads;
                videoTagAttributes.width = boxModel.model.width;
                videoTagAttributes.height = boxModel.model.height;
                if (boxModel.model.width <= 301 && boxModel.model.height <= 251) {
                    hasInBannerVideo = true;
                }
                videoTagAttributes.hasInBannerVideo = hasInBannerVideo;
                videoTagAttributes.autoplay = autoplay;
                //console.log('THis is the video player and size is ' + boxModel.model.width + ' x ' + boxModel.model.height);
                return videoTagAttributes;
            }
        }
        attrIndex = attrIndex + 1;
        //})
    }
    /*let videoJSObject = await DOM.resolveNode({nodeId: nodeId});
    console.log(videoJSObject);
    console.log(videoJSObject.object.objectId);
    *///await Runtime.callFunctionOn({objectId: videoJSObject.object.objectId, functionDeclaration:play.toString()});
    return videoTagAttributes;
}

async function sleep(Page, ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

async function parseVideos() {
    let vURLs = ['https://www.verywellhealth.com/avulsion-fracture-of-the-fifth-metatarsal-2548665',
        'https://www.verywellhealth.com/ankle-fracture-treatment-2549942',
    'https://www.verywellhealth.com/ankle-exercises-a-complete-guide-2696480',
        'https://www.verywellhealth.com/ankle-fusion-surgery-2549876',
            'https://www.verywellhealth.com/ankle-arthritis-surgery-1337605',
                'https://www.verywellhealth.com/all-about-osteoporosis-2549689',
                    'https://www.verywellhealth.com/ankle-exercises-a-complete-guide-2696480?_ga=2.107631047.413517315.1527729736-665215107.1526258687',
                        'https://www.verywellhealth.com/after-an-injury-inflammation-296941'];
    //vURLs = await readVideoURLs();
    await readDomains(); //get ad server domains
    for(i = 0; i < vURLs.length; i++){
        await analyze(vURLs[i]);
    }
}



async function captureVideoScreenshot(Page, Emulation, model) {
    try{
        const format = 'jpeg';
        console.log(model);
        //console.log('body ID '+bodyNodeId);
        /*const {model: {width, height}} = await DOM.getBoxModel({nodeId: bodyNodeId});*/
        const deviceMetrics = {
            width: model.width,
            height: model.height,
            deviceScaleFactor: 1,
            mobile: false,
            fitWindow: false,
        };
        console.log(deviceMetrics);
        //await Emulation.setDeviceMetricsOverride(deviceMetrics);
        //await Emulation.setVisibleSize({width: model.width, height: model.height});

        // get the base64 screenshot.
        const screenshot = await Page.captureScreenshot({format});
        let size = Buffer.byteLength(screenshot.data);

        // Save the base64 screenshot to binary image file
        const buffer = new Buffer.alloc(size, screenshot.data, 'base64');
        fs.writeFile('output.png', buffer, 'base64', function(err) {
            if (err) {
                console.error(err);
            } else {
                console.log('Screenshot saved');
            }
        });
    }catch (e) {
        console.log(e);
        console.log('body node ID not found');
    }
}

parseVideos();
//module.exports = app;
