const puppeteer = require('puppeteer');

async function analyze(vURL) {
    console.log('Parsing: '+vURL);
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(vURL);
    page.on('response', response => {
        let contentType = response.headers()["content-type"];
        console.log(response.headers()["content-type"]);
        if (response.headers()["content-type"].includes("video")){
            console.log(response.headers()["content-type"]);
        }
            console.log(response.url()+ " response code: ", response.status());
            //console.log(response.mimeType);
        // do something here
    });
    await sleep(page, 240000);
    await page.screenshot({path: 'example.png'});
    await browser.close();
}

async function parseVideos() {
    /*let vURLs = ['https://articles.sunset.com/garden/flowers-plants/gorgeous-dahlias?at=BN09Ha0OCf8b3j5RWXa4kjc1sbyMESDpgXCA7ZZTd5WFE8nG/NaBEBobhtF RdrAowW9d94VZiJgn8YEiQ==&qid=BLZoohJJNMg',
        'https://smores.tv/watch.php?v=187669&p=4068&utm_medium=p&utm_source=112321&click=112321_1515660922&prof=13902&pub=112321&sub1=2624088&sub3=',
        'https://www.dailymail.co.uk/health/article-5820763/Father-lost-limbs-lips-deadly-infection-says-facial-surgery-transformed-life.html',
        'https://okfreemovies.com/az-list/page/2',
        'https://www.momjunction.com/baby-names/nigerian/boy/starting-with-z/',
        'http://sculptnation.com'];*/
    let vURLs = ['https://smores.tv/watch.php?v=187669&p=4068&utm_medium=p&utm_source=112321&click=112321_1515660922&prof=13902&pub=112321&sub1=2624088&sub3='];
    //await readDomains(); //get ad server domains
    for(i = 0; i < vURLs.length; i++){
        await analyze(vURLs[i]);
    }
}

async function sleep(Page, ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

parseVideos();