window.onload = () => {
    const electron = require('electron')
    const ipcRenderer = electron.ipcRenderer
    let app = new Vue({
        el: '#app',
        data() {
            return {
                username: '',
                password: '',
                code: '',
                mac: '',
                isShowActivate: false,
                activeIcon: 'el-icon-circle-plus'
            }
        },
        mounted() {
            ipcRenderer.send('getMac')
            ipcRenderer.on('sendMac', (event, res) => {
                this.mac = res
            })
        },
        methods: {
            switchShowActivate() {
                if (this.isShowActivate) {
                    this.activeIcon = 'el-icon-circle-plus'
                    this.isShowActivate = false
                } else {
                    this.activeIcon = 'el-icon-remove'
                    this.isShowActivate = true
                }
            },
            login() {
                axios.get('http://map.qingguo188.com/index/code/verifyCode', {
                        params: {
                            name: this.username,
                            pwd: this.password,
                            code: this.code,
                            mac: this.mac
                        }
                    })
                    .then((response) => {
                        let data = response.data
                        if (data.status === 0) {
                            this.$notify.error({
                                title: '错误',
                                message: data.data,
                                duration: 1500,
                            });
                        }
                        if (data.status === 1) {
                            this.$notify({
                                title: '成功',
                                type: 'success',
                                message: data.data,
                                duration: 1500,
                                onClose: () => {
                                    console.log(1111)
                                    ipcRenderer.send('isLogin', this.username)
                                }
                            });
                        }
                        if (data.status === 2) {
                            this.$notify({
                                title: '成功',
                                type: 'success',
                                message: data.data,
                                duration: 1500,
                            });
                        }
                        console.log(data);
                    })
                    .catch((error) => {
                        console.log(error);
                    });
            }
        }
    })
}