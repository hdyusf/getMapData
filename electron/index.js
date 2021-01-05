window.onload = () => {
    const electron = require('electron')
    const ipcRenderer = electron.ipcRenderer
    let app = new Vue({
        el: '#app',
        data() {
            return {
                radio: 'Baidu',
                source: '',
                count: 0,
                dynamicTagsQuery: ['美食'],
                inputVisibleQuery: false,
                inputValueQuery: '',
                dynamicTagsCity: ['北京'],
                inputVisibleCity: false,
                inputValueCity: '',
                activeTabName: 'first',
                activeTabName2: 'setting',
                tableData: [],
                logs: [],
                getContinue: false,
                username: '',
                mac: ''
            }
        },
        computed: {
            animateCount() {
                return this.count.toFixed(0)
            }
        },
        watch: {
            tableData: function(newValue) {
                TweenLite.to(this.$data, 1, { count: newValue.length })
            }
        },
        mounted() {
            ipcRenderer.send('clearGather')
            ipcRenderer.on('exportDone', (event, res) => {
                this.$notify({
                    title: '成功',
                    message: res,
                    type: 'success',
                    duration: 2000,
                });
                this.logs.push(res)
                console.log(res)
            })
            ipcRenderer.on('sendError', (event, res) => {
                this.$notify.error({
                    title: '错误',
                    message: res,
                    duration: 2000,
                });
                console.log(res)
                this.logs.push(res)
            })
            ipcRenderer.on('sendJson', (event, res) => {
                this.logs.push(`成功获取查询数据${res.length}条`)
                console.log(`成功获取查询数据${res.length}条`)
                this.tableData.push(...res)
            })
            ipcRenderer.on('activeSendUserName', (event, res) => {
                this.username = res
            })
            ipcRenderer.send('getMac')
            ipcRenderer.on('sendMac', (event, res) => {
                this.mac = res
            })
        },
        methods: {
            radioClick(val) {
                this.logs.push('选择查询' + val)
                console.log(val)
                this.source = val
                this.clearGather()
            },
            handleCloseQuery(tag) {
                this.dynamicTagsQuery.splice(this.dynamicTagsQuery.indexOf(tag), 1);
            },
            showInputQuery() {
                this.inputVisibleQuery = true;
                this.$nextTick(_ => {
                    this.$refs.saveTagInput.$refs.input.focus();
                });
            },
            handleInputConfirmQuery() {
                let inputValue = this.inputValueQuery;
                if (inputValue) {
                    this.dynamicTagsQuery.push(inputValue);
                }
                this.inputVisibleQuery = false;
                this.inputValueQuery = '';
            },
            handleCloseCity(tag) {
                this.dynamicTagsCity.splice(this.dynamicTagsCity.indexOf(tag), 1);
            },
            showInputCity() {
                this.inputVisibleCity = true;
                this.$nextTick(_ => {
                    this.$refs.saveTagInput.$refs.input.focus();
                });
            },
            handleInputConfirmCity() {
                let inputValue = this.inputValueCity;
                if (inputValue) {
                    this.dynamicTagsCity.push(inputValue);
                }
                this.inputVisibleCity = false;
                this.inputValueCity = '';
            },
            startGather() {
                this.isRepeatLogin()
            },
            proceedGather() {
                let send = {
                    triggerName: this.radio,
                    query: this.dynamicTagsQuery.join(),
                    city: this.dynamicTagsCity.join(),
                }
                console.log(send)
                this.logs.push(`查询条件方式: ${send.triggerName}, 地址: ${send.city}, 关键词: ${send.query}`)
                ipcRenderer.send('getJson', send)
            },
            clearGather() {
                if (!this.tableData.length) {
                    this.getContinue = false
                    return console.log('已清空');
                }
                ipcRenderer.send('clearGather')
                this.tableData = []
                ipcRenderer.send('stopGather')
                this.getContinue = false
                let title = '已清空数据'
                this.logs.push(title)
                console.log(title)
                this.$notify.info({
                    title: '消息',
                    message: title,
                    duration: 2000,
                });
            },
            stopGather() {
                ipcRenderer.send('stopGather')
                this.getContinue = true
                let title = '已停止获取数据'
                this.logs.push(title)
                console.log(title)
                this.$notify.info({
                    title: '消息',
                    message: title,
                    duration: 2000,
                });
            },
            exportExcel() {
                if (!this.tableData.length) {
                    this.$notify.error({
                        title: '错误',
                        message: '没有数据可以导出',
                        duration: 2000,
                    });
                    console.log('没有数据可以导出');
                    return
                }
                let data = []
                this.tableData.map((item) => {
                    let arr = []
                    arr.push(item.source)
                    arr.push(item.name)
                    arr.push(item.fixedPhone)
                    arr.push(item.phone)
                    arr.push(item.prov)
                    arr.push(item.city)
                    arr.push(item.area)
                    arr.push(item.site)
                    data.push(arr)
                })
                let headTitle = []
                headTitle.push('来源')
                headTitle.push('名称')
                headTitle.push('固话')
                headTitle.push('手机')
                headTitle.push('省份')
                headTitle.push('地市')
                headTitle.push('区域')
                headTitle.push('详细地址')
                data.unshift(headTitle)
                let res = {
                    name: this.radio,
                    table: data
                }
                this.logs.push('数据导出 Excel')
                console.log('数据导出 Excel')
                ipcRenderer.send('exportExcel', res)
            },
            exportTxt() {
                if (!this.tableData.length) {
                    this.$notify.error({
                        title: '错误',
                        message: '没有数据可以导出',
                        duration: 2000,
                    });
                    console.log('没有数据可以导出');
                    return
                }
                let data = []
                this.tableData.map((item) => {
                    let arr = []
                    arr.push('\r\n' + item.source)
                    arr.push(item.name)
                    arr.push(item.fixedPhone)
                    arr.push(item.phone)
                    arr.push(item.prov)
                    arr.push(item.city)
                    arr.push(item.area)
                    arr.push(item.site)
                    data.push(arr)
                })
                let res = {
                    name: this.radio,
                    table: data
                }
                console.log('数据导出 Txt')
                this.logs.push('数据导出 Txt')
                ipcRenderer.send('exportTxt', res)
            },
            isRepeatLogin() {
                axios.get('http://map.qingguo188.com/index/code/isRepeatLogin', {
                        params: {
                            name: this.username,
                            mac: this.mac
                        }
                    })
                    .then((response) => {
                        let data = response.data
                        if (data.status === 0) {
                            this.$alert(data.data, '错误提示', {
                                confirmButtonText: '确定',
                                callback: action => {
                                    ipcRenderer.send('reloadLogin')
                                }
                            });
                        }
                        if (data.status === 1) {
                            this.proceedGather()
                            console.log(data);
                        }
                    })
                    .catch((error) => {
                        console.log(error);
                    });
            }
        }
    })
}