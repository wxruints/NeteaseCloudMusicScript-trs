/*
 All credit goes to the original author
                https://github.com/cimoc/NeteaseCloudMusicScript
                https://sokka.cn/107/

All credit goes to the translator
                https://github.com/wxruints/NeteaseCloudMusicScript-trs
                https://wxruints.github.io
                https://deepseek.com
        转译者：
                原先我在更新ESLyric时丢失了一个非常好用的脚本
                根据我的判断，这是由于旧脚本格式无法匹配新版本ESLyric所导致的
                于是我根据旧脚本备注时留存的项目地址与联系方式尝试联系作者，但并未联系上,且项目仓库也已删除
                在此时我有了转译脚本的打算
                感谢如今A.I.工具的发展，这使得我很快便完成了转译工作
                现在该脚本由deepseek编写主要框架，本人进行框架内的纠错、API更新和其他方面的进一步完善
                Translated by wxruints&Kiana Kaslana&DeepSeek


*/

export function getConfig(cfg) {
    cfg.name = "网易云多版本歌词获取(包含翻译)";
    cfg.version = "1.0.0.3,Trs-from old ver0.1.2 b6";
    cfg.author = "Auth.cimoc，Trans.wxruints";
}

export function getLyrics(meta, man) {
    
    // 更改lrc_order内标识顺序,设置歌词输出顺序,删除即不获取
    // newtype:并列合并,tran:翻译,origin:原版歌词,old_merge:并排合并歌词
    var lrc_order = [
        "old_merge",
        "newtype", 
        "origin",
        "tran",
    ];
    
    // 搜索歌词数,如果经常搜不到试着改小或改大
    var limit = 4;
    
    // 更改或删除翻译外括号
    // 提供一些括号〔 〕〈 〉《 》「 」『 』〖 〗【 】( ) [ ] { }
    var bracket = [
        "「", // 左括号
        "」"  // 右括号
    ];
    
    // 修复newtype歌词保存 翻译提前秒数 设为0则取消 如果翻译歌词跳的快看的难过,蕴情设为0.4-1.0
    var savefix = 0.01;
    // new_merge歌词翻译时间轴滞后秒数，防闪
    var timefix = 0.01;
    // 当timefix有效时设置offset(毫秒),防闪
    var offset = -20;
    
    var debug = false;
    
    // 删除feat.及之后内容并保存
    var titleResult = del(meta.title, "feat.");
    var artistResult = del(meta.artist, "feat.");
    var title = titleResult[0];
    var outstr1 = titleResult[1];
    var artist = artistResult[0];
    var outstr2 = artistResult[1];
    
    // 搜索
    var searchQuery = artist ? (title + "-" + artist) : title;
    var searchURL = "http://music.163.com/api/search/get/";
    
    var headers = {
        'Host': 'music.163.com',
        'Origin': 'http://music.163.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.90 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'http://music.163.com/search/',
        'Cookie': 'appver=1.5.0.75771'
    };
    
    var postData = 'hlpretag=<span class="s-fc7">&hlposttag=</span>&s=' + encodeURIComponent(searchQuery) + '&type=1&offset=0&total=true&limit=' + limit;
    
    var settings = {
        method: 'post',
        url: searchURL,
        headers: headers,
        body: postData
    };
    
    request(settings, (err, res, body) => {
        if (err || res.statusCode !== 200) {
            consoleLog(debug, 'Search failed: ' + res.statusCode);
            return;
        }
        
        try {
            var ncmBack = parseJson(body);
            if (!ncmBack || ncmBack.code !== 200) {
                consoleLog(debug, 'Get info failed');
                return;
            }
            
            var result = ncmBack.result || {};
            if (!result.songCount) {
                consoleLog(debug, 'No songs found');
                return;
            }
            
            var songs = result.songs || [];
            consoleLog(debug, 'Found ' + songs.length + ' songs');
            
            // 筛选曲名及艺术家
            var bestMatch = { index: 0, artistIndex: 0, score: [0, 0] };
            for (var k = 0; k < songs.length; k++) {
                var song = songs[k];
                var ncmName = song.name || '';
                
                for (var a_k = 0; a_k < (song.artists || []).length; a_k++) {
                    var ncmArtist = song.artists[a_k].name || '';
                    var p0 = compare(title, ncmName);
                    var p1 = compare(artist, ncmArtist);
                    
                    if (p0 === 100 && p1 === 100) {
                        bestMatch.index = k;
                        bestMatch.artistIndex = a_k;
                        bestMatch.score = [p0, p1];
                        break;
                    }
                    
                    if (p0 > bestMatch.score[0]) {
                        bestMatch.index = k;
                        bestMatch.artistIndex = a_k;
                        bestMatch.score = [p0, p1];
                    } else if (!artist && (p0 === bestMatch.score[0] && p1 > bestMatch.score[1])) {
                        bestMatch.index = k;
                        bestMatch.artistIndex = a_k;
                        bestMatch.score[1] = p1;
                    }
                }
            }
            
            var selectedSong = songs[bestMatch.index];
            var resId = selectedSong.id;
            var resName = selectedSong.name;
            var resArtist = selectedSong.artists[bestMatch.artistIndex].name;
            
            consoleLog(debug, resId + "-" + resName + "-" + resArtist);
            
            // 获取歌词
            var lyricURL = "http://music.163.com/api/song/lyric?os=pc&id=" + resId + "&lv=-1&kv=-1&tv=-1";
            var lyricSettings = {
                method: 'get',
                url: lyricURL,
                headers: headers
            };
            
            request(lyricSettings, (err, res, body) => {
                if (err || res.statusCode !== 200) {
                    consoleLog(debug, 'Get lyric failed: ' + res.statusCode);
                    return;
                }
                
                var ncmLrc = parseJson(body);
                if (!ncmLrc || !ncmLrc.lrc) {
                    consoleLog(debug, 'No lyric data');
                    return;
                }
                
                var hasTranslation = false;
                var hasOriginal = false;
                var translationLrc = '';
                var originalLrc = ncmLrc.lrc.lyric || '';
                
                if (originalLrc) {
                    hasOriginal = true;
                } else {
                    consoleLog(debug, 'No original lyric');
                }
                
                if (ncmLrc.tlyric && ncmLrc.tlyric.lyric) {
                    translationLrc = ncmLrc.tlyric.lyric.replace(/(〔|〕|〈|〉|《|》|「|」|『|』|〖|〗|【|】|{|}|\/)/g, "");
                    hasTranslation = true;
                } else {
                    consoleLog(debug, 'No translation');
                }
                
                if (!lrc_order.length) {
                    lrc_order = ["new_merge", "newtype", "origin", "tran"];
                }
                
                var finalTitle = resName + outstr1;
                var finalArtist = resArtist + outstr2;
                
                for (var key in lrc_order) {
                    switch (lrc_order[key]) {
                        case "old_merge":
                            if (hasOriginal && hasTranslation) {
                                addLyric(man, lrcMerge(originalLrc, translationLrc), finalTitle, finalArtist, "网易云并排旧");
                            }
                            break;
                        case "newtype":
                            if (hasOriginal && hasTranslation) {
                                addLyric(man, lrcNewtype(originalLrc, translationLrc, true), finalTitle, finalArtist, "网易云并列");
                            }
                            break;
                        case "origin":
                            if (hasOriginal) {
                                addLyric(man, originalLrc, finalTitle, finalArtist, "网易云原词");
                            }
                            break;
                        case "tran":
                            if (hasTranslation) {
                                addLyric(man, translationLrc, finalTitle, finalArtist, "网易云翻译");
                            }
                            break;
                        case "new_merge":
                            if (hasOriginal && hasTranslation) {
                                addLyric(man, lrcNewtype(originalLrc, translationLrc, false), finalTitle, finalArtist, "网易云并排");
                            }
                            break;
                    }
                }
            });
            
        } catch (e) {
            consoleLog(debug, 'Exception: ' + e.message);
        }
    });
}

function addLyric(man, lyricText, title, artist, source) {
    if (!lyricText) return;
    
    var lyricMeta = man.createLyric();
    lyricMeta.title = title;
    lyricMeta.artist = artist;
    lyricMeta.lyricText = lyricText;
    man.addLyric(lyricMeta);
}

function del(str, delthis) {
    var s = [str, ""];
    if (!str) return s;
    
    var set = str.indexOf(delthis);
    if (set === -1) {
        return s;
    }
    
    s[1] = " " + str.substr(set);
    s[0] = str.substring(0, set);
    return s;
}

function compare(x, y) {
    if (!x || !y) return 0;
    
    x = x.split("");
    y = y.split("");
    var z = 0;
    var s = x.length + y.length;
    
    x.sort();
    y.sort();
    var a = x.shift();
    var b = y.shift();
    
    while (a !== undefined && b !== undefined) {
        if (a === b) {
            z++;
            a = x.shift();
            b = y.shift();
        } else if (a < b) {
            a = x.shift();
        } else if (a > b) {
            b = y.shift();
        }
    }
    return z / s * 200;
}

function lrcMerge(olrc, tlrc) {
    olrc = olrc.split("\n");
    tlrc = tlrc.split("\n");
    
    // 获取时间轴位置
    var set = 0;
    for (var ii = 5; ii < 10; ii++) {
        var counter = olrc[ii].indexOf("]");
        counter = (counter === -1) ? 9 : counter;
        set += counter;
    }
    set = Math.round(set / 5);
    
    var i = 0;
    var l = tlrc.length;
    var lrc = [];
    
    for (var k in olrc) {
        var a = olrc[k].substring(1, set);
        while (i < l) {
            var j = 0;
            var tf = 0;
            while (j < 5) {
                if (i + j >= l) break;
                var b = tlrc[i + j].substring(1, set);
                if (a === b) {
                    tf = 1;
                    i += j;
                    break;
                }
                j++;
            }
            if (tf === 0) {
                lrc[k] = olrc[k];
                break;
            }
            var c = tlrc[i].substr(set + 1);
            if (c) {
                lrc[k] = olrc[k] + "「" + tlrc[i].substr(set + 1) + "」";
                i++;
                break;
            } else {
                lrc[k] = olrc[k];
                break;
            }
        }
    }
    return lrc.join("\n");
}

function lrcNewtype(olrc, tlrc, mergeType) {
    olrc = olrc.split("\n");
    tlrc = tlrc.split("\n");
    
    // 获取时间轴位置
    var set = 0;
    for (var ii = 5; ii < 10; ii++) {
        var counter = olrc[ii].indexOf("]");
        counter = (counter === -1) ? 9 : counter;
        set += counter;
    }
    set = Math.round(set / 5);
    
    var i = 0;
    var l = tlrc.length;
    var r = [];
    
    for (var k in olrc) {
        var a = olrc[k].substring(1, set);
        if (i >= l) break;
        
        var j = 0;
        var tf = 0;
        while (j < 5) {
            if (i + j >= l) break;
            var b = tlrc[i + j].substring(1, set);
            if (a === b) {
                tf = 1;
                i += j;
                break;
            }
            j++;
        }
        
        if (tf === 0) {
            r.push([k, false, a]);
        } else {
            r.push([k, i, a]);
        }
    }
    
    var lrc = [];
    var l_r = r.length;
    
    if (mergeType) {
        for (var kk = 0; kk < l_r; kk++) {
            var o = r[kk][0];
            var t = r[kk][1];
            var o_lrc = olrc[o].substr(set + 1);
            o_lrc = o_lrc ? olrc[o] : "[" + r[kk][2] + "]  ";
            lrc.push(o_lrc);
            
            var t_lrc = t !== false && tlrc[t].substr(set + 1) ? "「" + tlrc[t].substr(set + 1) + "」" : " ";
            
            if (kk + 2 > l_r) break;
            if (r[kk + 1][2]) {
                var timeb = r[kk + 1][2].replace(/(])/, "");
                var time = "[" + timeb + "]";
                lrc.push(time + t_lrc);
            }
        }
    } else {
        for (var kk = 0; kk < l_r; kk++) {
            var o = r[kk][0];
            var t = r[kk][1];
            var o_lrc = olrc[o].substr(set + 1);
            o_lrc = o_lrc ? olrc[o] : "[" + r[kk][2] + "]  ";
            
            var t_lrc = t !== false && tlrc[t].substr(set + 1) ? "「" + tlrc[t].substr(set + 1) + "」" : " ";
            
            if (kk + 2 > l_r) break;
            if (r[kk + 1][2]) {
                var timeb = r[kk + 1][2].replace(/(])/, "");
                var time = "[" + timeb + "]";
                lrc.push(o_lrc + " " + time + t_lrc);
            }
        }
    }
    
    return lrc.join("\n");
}

function prefix(num, length) {
    return (Array(length).join('0') + num).slice(-length);
}

function parseJson(text) {
    try {
        return JSON.parse(text);
    } catch (e) {
        console.log('[NeteaseCloudMusic] Parse JSON exception: ' + e.message);
        return null;
    }
}

function consoleLog(debug, msg) {
    if (debug) {
        console.log('[NeteaseCloudMusic] ' + msg);
    }
}