const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const ipcMain = electron.ipcMain
const https = require('https')
const os = require('os')
const path = require('path')
const util = require('util')
const http = require('http')
const request = require('request')
const fs = require('fs')
const xlsx = require('node-xlsx')
const iconv = require("iconv-lite")
const cheerio = require('cheerio')
// const client = require('electron-connect').client

let win, child
let stopGetUrlJson = false, username = ''
let page = 0
let gather = []
let isLogin = false

function createWindow() {
    let windowArg = {
        width: 1025,
        // width: 1550,
        height: 730,
        resizable: false,
        center: true,
        movable: true,
        minimizable: true,
        maximizable: false
    }
    win = new BrowserWindow(windowArg)
    win.loadFile('index.html')
    win.setMenu(null)
    win.on('closed', () => {
        win = null
        app.exit()
    })
    win.on('unresponsive', () => {
        //网页变得未响应时重启应用
        app.relaunch({
            args: process.argv.slice(1).concat(['--relaunch'])
        })
        app.exit(0)
    })
    // client.create(win)
    // win.webContents.openDevTools()
}

function createChildWindow() {
    let windowArg = {
        parent: win,
        show: false,
        width: 1025,
        // width: 1550,
        height: 730,
        resizable: false,
        center: true,
        movable: false,
        minimizable: true,
        maximizable: false
    }
    child = new BrowserWindow(windowArg)
    child.loadFile('login.html')
    child.setMenu(null)
    // child.webContents.openDevTools()
    child.once('ready-to-show', () => {
        child.show()
    })
    child.on('closed', () => {
        if (!isLogin) {
            win = null
            app.exit()
        }
    })
}

app.on('ready', () => {
    createWindow()
    createChildWindow()
    closeSecondInstance()
    ipcMessage()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (win == null) {
        createWindow()
    }
})

/**
 * 保证单一实例
 * @return {[type]} [description]
 */
function closeSecondInstance() {
    //判断是否是第二实例, 如果是 退出(保证单一实例)
    let myWindow = win
    const isSecondInstance = app.makeSingleInstance((commandLine, workingDirectory) => {
        if (myWindow) {
            if (myWindow.isMinimized())
                myWindow.restore()
            myWindow.focus()
        }
    })
    if (isSecondInstance) {
        app.quit()
    }
}

/**
 * 拼接字符串用以调用对应函数
 * @param  {object} res 包含方法名,城市,关键词的数据对象
 */
function getHomePage(res) {
    eval(`get${res.triggerName}('${res.city}', '${res.query}')`)
}

/**
 * 根据提供的url获取json数据 (request 版本)
 * @param  {string}   url      指定url
 * @param  {Function} callback 获取数据后的回调函数
 */
function getUrlJson(url) {
    return new Promise((resolve, reject) => {
        if (stopGetUrlJson) return false
        let headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36'
        }
        let opations = {
            url: encodeURI(url),
            method: 'GET',
            headers,
            encoding: null
        };
        request(opations, (error, response, data) => {
            if (!error && response.statusCode == 200) {
                let ct = response.headers['content-type']
                let transformCoding = 'utf-8'
                if (ct.indexOf('charset') > -1) {
                    let code = ct.match(/(?:charset=)(.+)/)[1]
                    transformCoding = code || transformCoding
                }
                let str = iconv.decode(data, transformCoding);
                console.log('爬取结束')
                resolve(str)
            } else {
                console.log('爬取出错');
            }
        })
    })
}

/**
 * 获取并处理 百度地图 数据
 * @param  {string} site  城市
 * @param  {string} query 关键词
 */
function getBaidu(site, query) {
    let source = '百度地图'
    let url = `https://map.baidu.com/?qt=spot&c=${site}&pn=${page}&wd=${query}&rn=50`
    let callback = function(res) {
        let parse = JSON.parse(res)
        if (typeof(parse.content) != 'undefined') {
            parse.content.map((item) => {
                let pattern = /\[(.*)省\(.*\[(.*)市\(.*\[(.*区)\(.*/g
                let prov, city, area
                if (pattern.test(item.address_norm)) {
                    pattern.lastIndex = 0
                    let matches = pattern.exec(item.address_norm)
                    prov = matches[1]
                    city = matches[2]
                    area = matches[3]
                }
                let telObj = processTel(item.tel, ',')
                if (telObj.fixedPhone || telObj.phone) {
                    let singleCase = {
                        source,
                        name: item.name,
                        fixedPhone: telObj.fixedPhone,
                        phone: telObj.phone,
                        prov,
                        city,
                        area,
                        site: item.addr
                    }
                    gather.push(singleCase)
                }
            })
        } else {
            sendError('查询数据格式出现错误, 请更新版本!')
            console.log('查询数据格式出现错误, 请更新版本!')
        }
        url = `https://map.baidu.com/?qt=spot&c=${site}&pn=${++page}&wd=${query}&rn=50`
        hasNextGetUrl(url, arguments.callee)
    }
    getUrlJson(url).then(callback)
}

/**
 * 获取并处理 高德地图 数据
 * @param  {string} site  城市
 * @param  {string} query 关键词
 */
function getGaode(site, query) {
    let source = '高德地图'
    let cityCode = 0
    let url = ''
    let callback = function(res) {
        let parse = JSON.parse(res)
        if (typeof(parse.data.poi_list) != 'undefined') {
            parse.data.poi_list.map((item) => {
                let telObj = processTel(item.tel, ';')
                if (telObj.fixedPhone || telObj.phone) {
                    let singleCase = {
                        source,
                        name: item.name,
                        fixedPhone: telObj.fixedPhone,
                        phone: telObj.phone,
                        prov: '',
                        city: item.cityname,
                        area: '',
                        site: item.address
                    }
                    gather.push(singleCase)
                }
            })
        } else {
            sendError('查询数据格式出现错误, 请更新版本!')
            console.log('查询数据格式出现错误, 请更新版本!')
        }
        url = `https://www.amap.com/service/poiInfo?query_type=TQUERY&pagesize=20&pagenum=${++page}&qii=true&cluster_state=5&need_utd=true&utd_sceneid=1000&div=PC1000&addr_poi_merge=true&is_classify=true&zoom=13&city=${cityCode}&keywords=${query}`
        hasNextGetUrl(url, arguments.callee)
    }
    let getCityCode = () => {
        let getCityUrl = 'https://www.amap.com/service/cityList'
        https.get(getCityUrl, (res) => {
            let str = ''
            res.on('data', (d) => {
                str += d
            })
            res.on('end', () => {
                let parse = JSON.parse(str)
                let isFind = false
                for (let item of Object.values(parse.data.cityByLetter)) {
                    item.map((depth) => {
                        let oneCondition = (site.length > depth.name.length) && (site.indexOf(depth.name) > -1)
                        let twoCondition = (depth.name.length > site.length) && (depth.name.indexOf(site) > -1)
                        let threeCondition = (site.length === depth.name.length) && (site === depth.name)
                        if (oneCondition || twoCondition || threeCondition) {
                            cityCode = depth.adcode
                            isFind = true
                        }

                    })
                }
                if (isFind) {
                    url = `https://www.amap.com/service/poiInfo?query_type=TQUERY&pagesize=20&pagenum=${++page}&qii=true&cluster_state=5&need_utd=true&utd_sceneid=1000&div=PC1000&addr_poi_merge=true&is_classify=true&zoom=13&city=${cityCode}&keywords=${query}`
                    getUrlJson(url).then(callback)
                } else {
                    sendError('未查询到相应的地址编码')
                    console.log('未查询到相应的地址编码')
                }
            })
        })
    }
    getCityCode()
}

/**
 * 获取并处理 搜狗地图 数据
 * @param  {string} site  城市
 * @param  {string} query 关键词
 */
function getSougou(site, query) {
    let source = '搜狗地图'
    let url = `http://map.sogou.com/EngineV6/search/json?what=keyword:${query}&range=city:${site}&othercityflag=1&appid=1361&thiscity=${site}&lastcity=${site}&userdata=3&encrypt=1&pageinfo=${++page},30&locationsort=0&version=7.0&ad=0&level=14&exact=1&type=&attr=&order=&submittime=0&resultTypes=poi,busline&reqid=1533968656323151&cb=parent.IFMS.search`
    let callback = function(res) {
        let pattern = /(parent\.IFMS\.search\()(.*)(\)$)/g
        if (pattern.test(res)) {
            pattern.lastIndex = 0
            let matches = pattern.exec(res)
            let data = matches[2]
            let parse = JSON.parse(data)
            if (typeof(parse.response.category.content.feature) != 'undefined') {
                let content = parse.response.category.content.feature
                content.map((item) => {
                    let telObj = processTel(item.detail.phone, ';')
                    if (telObj.fixedPhone || telObj.phone) {
                        let singleCase = {
                            source,
                            name: item.detail.poidesc,
                            fixedPhone: telObj.fixedPhone,
                            phone: telObj.phone,
                            prov: item.detail.province,
                            city: item.detail.city,
                            area: item.detail.county,
                            site: item.detail.address
                        }
                        gather.push(singleCase)
                    }
                })
            } else {
                sendError('查询数据格式出现错误, 请更新版本!')
                console.log('查询数据格式出现错误, 请更新版本!')
            }
        } else {
            sendError('没有匹配到数据, 请更新版本!')
            console.log('没有匹配到数据, 请更新版本!')
        }
        url = `http://map.sogou.com/EngineV6/search/json?what=keyword:${query}&range=city:${site}&othercityflag=1&appid=1361&thiscity=${site}&lastcity=${site}&userdata=3&encrypt=1&pageinfo=${++page},30&locationsort=0&version=7.0&ad=0&level=14&exact=1&type=&attr=&order=&submittime=0&resultTypes=poi,busline&reqid=1533968656323151&cb=parent.IFMS.search`
        hasNextGetUrl(url, arguments.callee)
    }
    getUrlJson(url).then(callback)
}

/**
 * 获取并处理 360地图 数据
 * @param  {string} site  城市
 * @param  {string} query 关键词
 */
function getPi(site, query) {
    let source = '360地图'
    let url = `https://ditu.so.com/app/pit?jsoncallback=pi&keyword=${query}&cityname=${site}&batch=${++page},${page + 1},${page + 2},${page + 3},${page + 4}&citysuggestion=true&qii=true&region_id=&map_cbc=on&scheme=https&ext=&regionType=rectangle&sid=1000&mobile=1&from_city_card=0&mp=&address_aggregation=1&shuidixy=1`
    let callback = function(res) {
        let pattern = /(pi\()(.*)(\)$)/g
        if (pattern.test(res)) {
            pattern.lastIndex = 0
            let matches = pattern.exec(res)
            let data = matches[2]
            let parse = JSON.parse(data)
            if (typeof(parse.poi) != 'undefined') {
                parse.poi.map((item) => {
                    let telObj = processTel(item.tel, ' ')
                    if (telObj.fixedPhone || telObj.phone) {
                        let singleCase = {
                            source,
                            name: item.name,
                            fixedPhone: telObj.fixedPhone,
                            phone: telObj.phone,
                            prov: item.province,
                            city: item.city,
                            area: item.area,
                            site: item.address
                        }
                        gather.push(singleCase)
                    }
                })
            } else {
                sendError('查询数据格式出现错误, 请更新版本!')
                console.log('查询数据格式出现错误, 请更新版本!')
            }
        } else {
            sendError('没有匹配到数据')
            console.log('没有匹配到数据')
        }
        url = `https://ditu.so.com/app/pit?jsoncallback=pi&keyword=${query}&cityname=${site}&batch=${page += 5},${page + 1},${page + 2},${page + 3},${page + 4}&citysuggestion=true&qii=true&region_id=&map_cbc=on&scheme=https&ext=&regionType=rectangle&sid=1000&mobile=1&from_city_card=0&mp=&address_aggregation=1&shuidixy=1`
        hasNextGetUrl(url, arguments.callee)
    }
    getUrlJson(url).then(callback)
}

/**
 * 获取并处理 必应地图 数据
 * @param  {string} site  城市
 * @param  {string} query 关键词
 */
function getBiying(site, query) {
    let source = '必应地图'
    let url = `https://cn.bing.com/maps/overlay?q=${query}&mapcardtitle=${query}&p1=[AplusAnswer]&count=20&first=${page}&isFallbackQuery=true`
    let callback = function(res) {
        let decodeRes = decodeHtml(res)
        let $ = cheerio.load(decodeRes)
        let htmlObject = $('a.listings-item')
        if (htmlObject) {
            for (let item of Object.values(htmlObject)) {
                let pattern = /(?:title\\":\\")(.*?)(?:\\",)(?:.*)(?:address\\":\\")(.*?)(?:\\",)(?:.*)(?:phone\\":\\")(.*?)(?:\\",)/g
                let stringify = JSON.stringify(item.attribs)
                let matches = pattern.exec(stringify)
                if (matches) {
                    let name = matches[1],
                        address = matches[2],
                        tel = matches[3],
                        prov, city, area, site
                    if (address) {
                        let sitePattern = /((?:.*?)省)?((?:.*?)市)?((?:.*?[^小商\w])区)?(.*)/g
                        let siteResolve = sitePattern.exec(address)
                        if (siteResolve) {
                            prov = siteResolve[1],
                                city = siteResolve[2],
                                area = siteResolve[3],
                                site = siteResolve[4]
                        } else {
                            site = address
                        }
                    }
                    let telObj = processTel(tel, ' ')
                    if ((telObj.fixedPhone || telObj.phone) && telObj.phone.indexOf('+') === -1) {
                        let singleCase = {
                            source,
                            name,
                            fixedPhone: telObj.fixedPhone,
                            phone: telObj.phone,
                            prov,
                            city,
                            area,
                            site
                        }
                        gather.push(singleCase)
                    }
                }
            }
        } else {
            sendError('没有匹配到数据')
            console.log('没有匹配到数据')
        }
        url = `https://cn.bing.com/maps/overlay?q=${query}&mapcardtitle=${query}&p1=[AplusAnswer]&count=20&first=${page += 20}&isFallbackQuery=true`
        hasNextGetUrl(url, arguments.callee)
    }
    getUrlJson(url).then(callback)
}

/**
 * 获取并处理 腾讯地图 数据
 * @param  {string} site  城市
 * @param  {string} query 关键词
 */
function getTengxun(site, query) {
    let source = '腾讯地图'
    let url = `https://apis.map.qq.com/jsapi?qt=poi&wd=${query}&pn=${page}&rn=20&rich_source=qipao&rich=web&nj=0&c=${site}&output=jsonp&pf=jsapi&ref=jsapi&cb=qq`
    let callback = function(res) {
        let pattern = /(?:qq\()((?:.|\s)*)(?:\)$)/g
        if (pattern.test(res)) {
            pattern.lastIndex = 0
            let matches = pattern.exec(res)
            let data = matches[1]
            let parse = JSON.parse(data)
            if (typeof(parse.detail.pois) != 'undefined') {
                parse.detail.pois.map((item) => {
                    let telObj = processTel(item.phone, '; ')
                    if (telObj.fixedPhone || telObj.phone) {
                        let singleCase = {
                            source,
                            name: item.name,
                            fixedPhone: telObj.fixedPhone,
                            phone: telObj.phone,
                            prov: item.POI_PATH[2].cname,
                            city: item.POI_PATH[1].cname,
                            area: item.POI_PATH[0].cname,
                            site: item.addr
                        }
                        gather.push(singleCase)
                    }
                })
            } else {
                sendError('查询数据格式出现错误, 请更新版本!')
                console.log('查询数据格式出现错误, 请更新版本!')
            }
        } else {
            sendError('没有匹配到数据')
            console.log('没有匹配到数据')
        }
        url = `https://apis.map.qq.com/jsapi?qt=poi&wd=${query}&pn=${++page}&rn=20&rich_source=qipao&rich=web&nj=0&c=${site}&output=jsonp&pf=jsapi&ref=jsapi&cb=qq`
        hasNextGetUrl(url, arguments.callee)
    }
    getUrlJson(url).then(callback)
}

/**
 * 是否进行下一次的数据获取
 * @param  {array}   gather   需要返回前端的数据
 * @param  {string}   url      下一次的请求地址
 * @param  {Function} callback 下一次请求完成后的回调函数
 */
function hasNextGetUrl(url, callback) {
    if (gather) {
        setTimeout(() => {
            getUrlJson(url).then(callback)
        }, 800)
        console.log('+++数据已发送到前台', gather.length)
        win.webContents.send('sendJson', gather)
        gather = []

    } else {
        sendError('未查询到相关信息')
    }
}

/**
 * 加工获取的手机和固话号
 * @param  {string} telStr        电话数据字符串
 * @param  {string} cutSymbol     分隔符
 * @return {object}               处理过的对象
 */
function processTel(telStr, cutSymbol) {
    let fixedPhone = '',
        phone = '',
        fixedPhoneHouse = [],
        phoneHouse = []
    if (telStr) {
        if (telStr.indexOf(cutSymbol) > -1) {
            let telArr = telStr.split(cutSymbol)
            telArr.map((item) => {
                if ((item.indexOf('-') > -1) || (item.indexOf('(') > -1)) {
                    fixedPhoneHouse.push(item)
                    fixedPhone = fixedPhoneHouse.join(' ')
                } else {
                    phoneHouse.push(item)
                    phone = phoneHouse.join('')
                }
            })
        } else {
            if ((telStr.indexOf('-') > -1) || (telStr.indexOf('(') > -1)) {
                fixedPhone = telStr
            } else {
                phone = telStr
            }
        }
    }
    let rObj = {
        fixedPhone,
        phone
    }
    return rObj
}

/**
 * 监听方法
 */
function ipcMessage() {
    ipcMain.on('getJson', (event, res) => {
        console.log('收到查询指令: ', res)
        stopGetUrlJson = false
        getHomePage(res)
    })
    ipcMain.on('stopGather', (event, res) => {
        console.log('收到停止命令')
        stopGetUrlJson = true
    })
    ipcMain.on('clearGather', (event, res) => {
        console.log('收到清除命令')
        page = 0
        gather = []
    })
    ipcMain.on('exportExcel', (event, res) => {
        console.log('收到导出 Excel 命令')
        writeXlsx(res.name, res.table)
    })
    ipcMain.on('exportTxt', (event, res) => {
        console.log('收到导出 Txt 命令')
        writeTxt(res.name, res.table)
    })
    ipcMain.on('isLogin', (event, res) => {
        console.log('收到已登录验证命令', res)
        username = res
        isLogin = true
        console.log('登录用户:', username)
        win.webContents.send('activeSendUserName', username)
        console.log('向主页面发送登录用户信息')
        child.hide()
    })
    ipcMain.on('getMac', (event, res) => {
        console.log('收到获取mac地址命令')
        let mac = getMac()
        console.log('mac: ', mac)
        event.sender.send('sendMac', mac)
    })
    ipcMain.on('reloadLogin', (event, res) => {
        console.log('收到重新登录命令')
        username = ''
        isLogin = false
        child.show()
    })
}

/**
 * 向前端发送错误信息
 */
function sendError(data) {
    win.webContents.send('sendError', data)
    stopGetUrlJson = true
}

/**
 * 导出文件的公用方法
 * @param  {string} name    文件名称
 * @param  {string} postfix 文件后缀
 * @param  {buffer或array} data    需要导出的数据
 */
function writeFilePublic(name, postfix, data) {
    (name == 'Pi') && (name = '360')
    let fileName = name + getDate() + postfix
    fs.writeFile(fileName, data, (err) => {
        if (err) {
            return sendError('导出文件出错, 请重启后再试!')
        }
        let desktop = 'C:\\Users\\Administrator\\Desktop\\'
        let oldFile = fs.createReadStream(fileName)
        let newFile = fs.createWriteStream(path.join(desktop, fileName))
        oldFile.pipe(newFile)
        oldFile.on('end', () => {
            fs.unlinkSync(fileName)
        });
        win.webContents.send('exportDone', '数据导出成功')
    })
}

/**
 * 导出到xlsx文件
 * @param  {string} name 文件名称
 * @param  {array} res  需要导出的数据
 * @return {function}      调用导出文件的公用方法
 */
function writeXlsx(name, res) {
    let buffer = xlsx.build([{
        'name': name,
        'data': res
    }])
    writeFilePublic(name, '.xlsx', buffer)
}

/**
 * 导出到txt文件
 * @param  {string} name 文件名称
 * @param  {array} res  需要导出的数据
 * @return {function}      调用导出文件的公用方法
 */
function writeTxt(name, res) {
    writeFilePublic(name, '.txt', res)
}

/**
 * 获取指定的时间格式
 * @return {string} 指定的时间格式
 */
function getDate() {
    let time = new Date()
    let year = time.getFullYear()
    let month = time.getMonth()
    let date = time.getDate()
    let hours = time.getHours()
    let minutes = time.getMinutes()
    let seconds = time.getSeconds()
    let sortTime = '-' + year + month + date + hours + minutes + seconds
    return sortTime
}

/**
 * 解码html
 * @param  {string} str 需要解码的html文本
 * @return {string}     解码后的html文本
 */
function decodeHtml(str) {
    var s = "";
    if (str.length == 0) return "";
    s = str.replace(/&amp;/gi, "&");
    s = s.replace(/&lt;/gi, "<");
    s = s.replace(/&gt;/gi, ">");
    s = s.replace(/&nbsp;/gi, " ");
    s = s.replace(/&#39;/gi, "\'");
    s = s.replace(/&quot;/gi, "\"");
    return s;
}

/**
 * 获取当前电脑网卡的IPv4 mac地址
 * @return {string} IPv4 mac地址
 */
function getMac() {
    //获取电脑网卡mac地址
    let interfaces = os.networkInterfaces()
    for (let devName in interfaces) {
        var iface = interfaces[devName]
        for (let face of iface) {
            if (face.family == 'IPv4' && face.address != '127.0.0.1' && !face.internal) {
                return face.mac
            }
        }
    }
}