const webSite = 'https://mo.muouso.fun';

async function newfetch(url, options = {}) {
    let request = await sendMessage("fetch", JSON.stringify({ "url": url, "options": options }));
    const response = () => ({
        ok: Math.floor(request.status / 100) === 2,
        statusText: request.statusText,
        status: request.status,
        url: request.responseURL,
        text: () => Promise.resolve(request.responseText),
        json: () => Promise.resolve(request.responseText).then(JSON.parse),
        blob: () => Promise.resolve(new Blob([request.response])),
        clone: response,
        headers: request.headers,
    });
    return request.ok ? response() : Promise.reject(response());
}

function extractShareId(url) {
    const regex = /\/s\/([a-f0-9]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

async function 访问网页(url, method = 'GET', postParams, cookie, headers, timeout = 15000, setCookieCallback) {
    const methods = ['GET', 'POST', 'PUT'];
    const requestMethod = methods[method] || 'GET';
    const requestHeaders = {};

    if (cookie) requestHeaders['Cookie'] = cookie;
    if (headers) {
        headers.split('\n').forEach(header => {
            const [key, value] = header.split(':').map(str => str.trim());
            if (key && value) requestHeaders[key] = value;
        });
    }
    const requestOptions = {
        method: requestMethod,
        headers: requestHeaders,
        body: (requestMethod === 'POST' || requestMethod === 'PUT') ? postParams : null,
        redirect: 'follow'
    };

    const fetchPromise = newfetch(url, requestOptions);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), timeout));
    const response = await Promise.race([fetchPromise, timeoutPromise]);

    const responseText = await response.text();
    if (setCookieCallback) {
        const responseHeaders = JSON.parse(response.headers);
        const setCookie = responseHeaders['set-cookie'];
        if (setCookie) setCookieCallback(setCookie);
    }
    return responseText;
}

async function playerContent(vod_id) {
    try {
        const decodedVodId = decodeURIComponent(vod_id);
        const vodData = JSON.parse(decodedVodId);
        const isQuark = vodData.isQuark;
        let getUrl, createUrl, fileUrl, playUrl, deleteUrl, origin, cookie;

        if (isQuark) {
            getUrl = `https://drive-pc.quark.cn/1/clouddrive/file/sort?pr=ucpro&fr=pc&uc_param_str=&pdir_fid=0&_page=1&_size=100&_fetch_total=false&_fetch_sub_dirs=1&_sort=&__dt=1604987&__t=${Date.now()}`;
            createUrl = `https://drive-pc.quark.cn/1/clouddrive/file?pr=ucpro&fr=pc&uc_param_str=`;
            fileUrl = `https://pc-api.uc.cn/1/clouddrive/file/sort?pr=UCBrowser&fr=pc&pdir_fid=${vodData.to_pdir_fid}&_page=1&_size=50&_fetch_total=1&_fetch_sub_dirs=0&_sort=file_type:asc,updated_at:desc`;
            playUrl = `https://drive-pc.quark.cn/1/clouddrive/file/v2/play?pr=ucpro&fr=pc&uc_param_str=`;
            deleteUrl = `https://drive-pc.quark.cn/1/clouddrive/file/delete?pr=ucpro&fr=pc&uc_param_str=`;
            origin = `https://pan.quark.cn`;
            cookie = quarkCookie;
        } else {
            getUrl = `https://pc-api.uc.cn/1/clouddrive/file/sort?pr=UCBrowser&fr=pc&pdir_fid=0&_page=1&_size=50&_fetch_total=1&_fetch_sub_dirs=0&_sort=file_type:asc,updated_at:desc`;
            createUrl = `https://pc-api.uc.cn/1/clouddrive/file?pr=UCBrowser&fr=pc`;
            fileUrl = `https://pc-api.uc.cn/1/clouddrive/file/sort?pr=UCBrowser&fr=pc&pdir_fid=${vodData.to_pdir_fid}&_page=1&_size=50&_fetch_total=1&_fetch_sub_dirs=0&_sort=file_type:asc,updated_at:desc`;
            playUrl = `https://pc-api.uc.cn/1/clouddrive/file/v2/play?pr=UCBrowser&fr=pc`;
            deleteUrl = `https://pc-api.uc.cn/1/clouddrive/file/delete?pr=UCBrowser&fr=pc`;
            origin = `https://drive.uc.cn`;
            cookie = ucCookie;
        }

        let page = 1;
        let tBoxFid = null;
        while (!tBoxFid) {
            const getResponse = await 访问网页(getUrl, 0, null, cookie);
            const getData = JSON.parse(getResponse);
            if (getData.status !== 200 || getData.code !== 0) throw new Error(`Failed to get file list: ${getData.message}`);
            const tBoxFolder = getData.data.list.find(file => file.file_type === 0 && file.file_name === "tBox");
            if (tBoxFolder) tBoxFid = tBoxFolder.fid;
            if (getData.data.list.length < 100) break;
            page++;
        }

        if (!tBoxFid) {
            const createParams = JSON.stringify({ pdir_fid: "0", file_name: "tBox", dir_path: "", dir_init_lock: false });
            const createResponse = await 访问网页(createUrl, 1, createParams, cookie, isQuark ? "Content-Type: application/json\nOrigin: https://pan.quark.cn\nReferer: https://pan.quark.cn/" : "Content-Type: application/json\nOrigin: https://drive.uc.cn\nReferer: https://drive.uc.cn/");
            const createData = JSON.parse(createResponse);
            if (createData.status !== 200 || createData.code !== 0) throw new Error(`Failed to create tBox folder: ${createData.message}`);
            tBoxFid = createData.data.fid;
        }

        vodData.to_pdir_fid = tBoxFid;
        const tBoxFileUrl = isQuark ? `https://drive-pc.quark.cn/1/clouddrive/file/sort?pr=ucpro&fr=pc&uc_param_str=&pdir_fid=${tBoxFid}&_page=1&_size=50&_fetch_total=1&_fetch_sub_dirs=0&_sort=file_type:asc,updated_at:desc` : `https://pc-api.uc.cn/1/clouddrive/file/sort?pr=UCBrowser&fr=pc&uc_param_str=&pdir_fid=${tBoxFid}&_page=1&_size=50&_fetch_total=1&_fetch_sub_dirs=0&_sort=file_type:asc,updated_at:desc`;
        const tBoxFileResponse = await 访问网页(tBoxFileUrl, 0, null, cookie);
        const tBoxFileData = JSON.parse(tBoxFileResponse);
        if (tBoxFileData.status !== 200 || tBoxFileData.code !== 0) throw new Error(`Failed to get tBox file list: ${tBoxFileData.message}`);
        const fids = tBoxFileData.data.list.map(file => file.fid);
        if (fids.length > 0) {
            const deleteParams = JSON.stringify({ action_type: 2, filelist: fids, exclude_fids: [] });
            await 访问网页(deleteUrl, 1, deleteParams, cookie, "Content-Type: application/json;charset=UTF-8");
        }

        let retryCount = 0;
        let videoLinks = null;
        let saveAsTopFid = null;

        while (retryCount < 5 && !videoLinks) {
            const saveUrl = isQuark ? `https://drive-pc.quark.cn/1/clouddrive/share/sharepage/save?pr=ucpro&fr=pc&uc_param_str=&__dt=2460776&__t=${Date.now()}` : `https://pc-api.uc.cn/1/clouddrive/share/sharepage/save?pr=UCBrowser&fr=pc`;
            const saveParams = JSON.stringify(vodData);
            const saveResponse = await 访问网页(saveUrl, 1, saveParams, cookie, isQuark ? "Content-Type: application/json\nOrigin: https://pan.quark.cn\nReferer: https://pan.quark.cn/" : "Content-Type: application/json\nOrigin: https://drive.uc.cn\nReferer: https://drive.uc.cn/");
            const saveData = JSON.parse(saveResponse);
            if (saveData.status !== 200 || saveData.code !== 0) throw new Error(`Failed to save vodData: ${saveData.message}`);
            const taskId = saveData.data.task_id;

            let retryIndex = 0;
            let isTaskFinished = false;

            while (retryIndex < 15 && !isTaskFinished) {
                const taskUrl = isQuark ? `https://drive-pc.quark.cn/1/clouddrive/task?pr=ucpro&fr=pc&uc_param_str=&task_id=${taskId}&retry_index=${retryIndex}&__dt=337800&__t=${Date.now()}` : `https://pc-api.uc.cn/1/clouddrive/task?pr=UCBrowser&fr=pc&uc_param_str=&task_id=${taskId}&retry_index=${retryIndex}&__dt=337800&__t=${Date.now()}`;
                const taskResponse = await 访问网页(taskUrl, 0, "", cookie, isQuark ? "Origin: https://pan.quark.cn\nReferer: https://pan.quark.cn/" : "Content-Type: application/json\nOrigin: https://drive.uc.cn\nReferer: https://drive.uc.cn/");
                const taskData = JSON.parse(taskResponse);

                if (taskData.status === 400 && taskData.code === 32003) {
                    const fileResponse = await 访问网页(fileUrl, 0, "", cookie, isQuark ? "Content-Type: application/json\nOrigin: https://pan.quark.cn\nReferer: https://pan.quark.cn/" : "Content-Type: application/json\nOrigin: https://drive.uc.cn\nReferer: https://drive.uc.cn/");
                    const fileData = JSON.parse(fileResponse);
                    const fileList = fileData.data.list;
                    const targetFile = fileList.find(file => file.size === vodData.fid_size);
                    if (targetFile) {
                        isTaskFinished = true;
                        saveAsTopFid = targetFile.fid;
                    }
                } else if (taskData.status !== 200 || taskData.code !== 0) {
                    throw new Error(`Failed to get task status: ${taskData.message}`);
                } else if (taskData.data.finished_at) {
                    isTaskFinished = true;
                    saveAsTopFid = taskData.data.save_as.save_as_top_fids[0];
                }

                retryIndex++;
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (!isTaskFinished) throw new Error("Task did not finish within the expected time.");

            let retryCountForPlay = 0;
            let mySetCookie = null;

            const fetchPlayResponse = async (url, params, headers) => {
                return await 访问网页(url, 1, params, cookie, headers, 15000, setCookie => {
                    mySetCookie = setCookie;
                });
            };

            const mergeCookies = newCookies => {
                return [...new Set([...newCookies, ...cookie.split(";").map(item => item.trim())])].join("; ");
            };

            const handlePlayResponse = playResponse => {
                let playData = JSON.parse(playResponse);
                if (playData.status !== 200 || playData.code !== 0) {
                    if (playData.message.includes("文件已删除") || playData.message.includes("file not found")) return null;
                    throw new Error(`Failed to get video playback links: ${playData.message}`);
                }
                return playData;
            };

            if (isQuark) {
                while (retryCountForPlay < 5 && !videoLinks) {
                    try {
                        const playParams = JSON.stringify({ fid: saveAsTopFid, resolutions: "normal,low,high,super,2k,4k", supports: "fmp4,m3u8" });
                        const playResponse = await fetchPlayResponse(playUrl, playParams, `Referer: ${origin}`);
                        const playData = handlePlayResponse(playResponse);
                        if (!playData) break;
                        videoLinks = playData.data.video_list.map(video => {
                            const url = video.video_info && video.video_info.url ? video.video_info.url : null;
                            if (url) return { url, resolution: video.resolution, member_right: video.member_right, width: video.video_info.width, height: video.video_info.height };
                        }).filter(video => video !== undefined);

                        if (mySetCookie) {
                            const newCookies = mySetCookie.split(",").map(item => item.split(";")[0].trim()).filter(item => item !== undefined);
                            cookie = mergeCookies(newCookies);
                        }
                    } catch (error) {
                        retryCountForPlay++;
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            } else {
                const playParams = JSON.stringify({ fids: [saveAsTopFid] });
                const playResponse = await fetchPlayResponse("https://pc-api.uc.cn/1/clouddrive/file/download?pr=UCBrowser&fr=pc", playParams, `Content-Type: application/json;charset=UTF-8\nReferer: ${origin}`);
                const playData = handlePlayResponse(playResponse);
                if (!playData) return null;
                const downloadUrl = playData.data[0].download_url;
                if (downloadUrl) {
                    videoLinks = [{ url: downloadUrl }];
                    if (mySetCookie) {
                        const newCookies = mySetCookie.split(",").map(item => item.split(";")[0].trim()).filter(item => item !== undefined);
                        cookie = mergeCookies(newCookies);
                    }
                }
            }

            if (!videoLinks) {
                retryCount++;
                if (retryCount < 5) await new Promise(resolve => setTimeout(resolve, 5000));
                else throw new Error("Failed to get video playback links after 3 attempts.");
            }
        }

        const deleteParams = JSON.stringify({ action_type: 2, filelist: [saveAsTopFid], exclude_fids: [] });
        const deleteResponse = await 访问网页(deleteUrl, 1, deleteParams, cookie, isQuark ? "Content-Type: application/json\nOrigin: https://pan.quark.cn\nReferer: https://pan.quark.cn/" : "Content-Type: application/json\nOrigin: https://drive.uc.cn\nReferer: https://drive.uc.cn/");
        const deleteData = JSON.parse(deleteResponse);
        if (deleteData.status !== 200 || deleteData.code !== 0) throw new Error(`Failed to delete file: ${deleteData.message}`);

        const result = {
            parse: 1,
            header: `Cookie: ${cookie}\nOrigin: ${origin}\nReferer: ${origin}`,
            playUrl: "",
            url: videoLinks.length > 0 ? videoLinks[0].url : ""
        };
        return JSON.stringify(result);
    } catch (error) {
        return JSON.stringify({ parse: 1, header: "", playUrl: "", url: "", message: `获取链接失败: ${error}` });
    }
}

async function fetchVideoFiles(url) {
    try {
        const pwd_id = extractShareId(url);
        const isQuark = !url.includes(".uc.cn");

        const postUrl = url.includes(".uc.cn") ? "https://pc-api.uc.cn/1/clouddrive/share/sharepage/v2/detail?pr=UCBrowser&fr=pc" : `https://drive-h.quark.cn/1/clouddrive/share/sharepage/token?pr=ucpro&fr=pc&uc_param_str=&__dt=300&__t=${Date.now()}`;
        const postParams = url.includes(".uc.cn") ? JSON.stringify({ pwd_id, passcode: "", force: 0, page: 1, size: 50, fetch_banner: 1, fetch_share: 1, fetch_total: 1, sort: "file_type:asc,file_name:asc", banner_platform: "other", banner_channel: "share_page" }) : JSON.stringify({ pwd_id, passcode: "" });
        const postResponse = await 访问网页(postUrl, 1, postParams, null, "Content-Type: application/json;charset=UTF-8");

        if (postResponse.includes("好友已取消了分享")) return '该网盘已取消了分享$1';

        const postData = JSON.parse(postResponse);
        if (postData.status !== 200 || postData.code !== 0) throw new Error(`Failed to get stoken: ${postData.message}`);
        const stoken = url.includes(".uc.cn") ? postData.data.token_info.stoken : postData.data.stoken;

        async function fetchFiles(pdir_fid) {
            let page = 1;
            let allFiles = [];
            while (true) {
                const getUrl = url.includes(".uc.cn") ? `https://pc-api.uc.cn/1/clouddrive/share/sharepage/detail?pr=UCBrowser&fr=pc&pwd_id=${pwd_id}&stoken=${encodeURIComponent(stoken)}&pdir_fid=${pdir_fid}&force=0&_page=${page}&_size=50&_fetch_total=1&_fetch_sub_dirs=0&_sort=file_type:asc,updated_at:desc` : `https://drive-h.quark.cn/1/clouddrive/share/sharepage/detail?pr=ucpro&fr=pc&uc_param_str=&pwd_id=${pwd_id}&stoken=${encodeURIComponent(stoken)}&pdir_fid=${pdir_fid}&force=0&_page=${page}&_size=50&_fetch_total=1&_fetch_sub_dirs=0&_sort=file_type:asc,updated_at:desc`;
                const getResponse = await 访问网页(getUrl, 0);
                const getData = JSON.parse(getResponse);
                if (getData.status !== 200 || getData.code !== 0) throw new Error(`Failed to get file list: ${get
