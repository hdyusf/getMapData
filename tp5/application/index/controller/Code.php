<?php
namespace app\index\controller;

use app\common\controller\HomeBase;
use think\Db;
use think\Config;

class Code extends HomeBase
{
    public function verifyCode($name = '', $pwd = '', $code = '', $mac = '')
    {
        $user = db('user')->where('username', $name)->find();
        if ($user) {
            $pwd_md5 = md5($pwd . Config::get('salt'));
            if ($user['password'] !== $pwd_md5) {
                $result = [
                    'status' => 0,
                    'data' => '密码错误'
                ];
                return json_encode($result);
            }
            //用户已注册且密码正确
            if ($user['password_code']) {
                //拥有已有激活码
                if ($code) {
                    //拥有已有激活码, 再次填写了激活码, 检查已有激活码是否可用
                    $code_find = db('password')->where('code', $user['password_code'])->find();
                    if ($code_find) {
                        //查到用户已有激活码
                        if (strtotime($code_find['pastdue_time']) > time()) {
                            $result = [
                                'status' => 0,
                                'data' => '该账户已激活, 尚未过期'
                            ];
                            return json_encode($result);
                        }
                    } else {
                        //未查到已有激活码, 使用新激活码激活
                        $code_find = db('password')->where('code', $code)->find();
                        if ($code_find) {
                            if ($code_find['user_status']) {
                                $result = [
                                    'status' => 0,
                                    'data' => '激活码已激活'
                                ];
                                return json_encode($result);
                            }
                            if (strtotime($code_find['pastdue_time']) < time()) {
                                $result = [
                                    'status' => 0,
                                    'data' => '激活码已失效'
                                ];
                                return json_encode($result);
                            }
                            //激活码可以使用, 使用后更改激活码激活状态
                            if (db('user')->where('username', $name)->update(['password_code' => $code]) !== false && db('password')->where('code', $code)->update(['user_status' => 1]) !== false) {
                                $result = [
                                    'status' => 1,
                                    'data' => '延期激活成功'
                                ];
                                return json_encode($result);
                            } else {
                                $result = [
                                    'status' => 0,
                                    'data' => '延期激活失败'
                                ];
                                return json_encode($result);
                            }
                        } else {
                            $result = [
                                'status' => 0,
                                'data' => '激活码不存在'
                            ];
                            return json_encode($result);
                        }
                    }
                } else {
                    //拥有激活码, 没有再次填写, 验证激活码是否有效
                    $code_find = db('password')->where('code', $user['password_code'])->find();
                    if ($code_find) {
                        if (strtotime($code_find['pastdue_time']) < time()) {
                            $result = [
                                'status' => 0,
                                'data' => '已有激活码已失效'
                            ];
                            return json_encode($result);
                        }
                        if ($code_find['user_status']) {
                            db('user')->where('username', $name)->update(['last_login_ip' => $mac]);
                            $result = [
                                'status' => 1,
                                'data' => '登录成功'
                            ];
                            return json_encode($result);
                        } else {
                            $result = [
                                'status' => 0,
                                'data' => '登录失败'
                            ];
                            return json_encode($result);
                        }
                    } else {
                        $result = [
                            'status' => 0,
                            'data' => '已有激活码不存在'
                        ];
                        return json_encode($result);
                    }
                }
            } else {
                //没有已有激活码
                if ($code) {
                    //填写了激活码, 检查激活码是否可用
                    $code_find = db('password')->where('code', $code)->find();
                    if ($code_find) {
                        if (strtotime($code_find['pastdue_time']) < time()) {
                            $result = [
                                'status' => 0,
                                'data' => '激活码已失效'
                            ];
                            return json_encode($result);
                        }
                        if ($code_find['user_status']) {
                            $result = [
                                'status' => 0,
                                'data' => '激活码已被使用过'
                            ];
                            return json_encode($result);
                        }
                        if (db('user')->where('username', $name)->update(['password_code' => $code]) !== false && db('password')->where('code', $code)->update(['user_status' => 1]) !== false) {
                            $result = [
                                'status' => 1,
                                'data' => '激活成功'
                            ];
                            return json_encode($result);
                        } else {
                            $result = [
                                'status' => 0,
                                'data' => '激活失败'
                            ];
                            return json_encode($result);
                        }
                    } else {
                        $result = [
                            'status' => 0,
                            'data' => '激活码不存在'
                        ];
                        return json_encode($result);
                    }
                } else {
                    //没有填写激活码
                    $result = [
                        'status' => 0,
                        'data' => '用户尚未激活'
                    ];
                    return json_encode($result);
                }
            }
        } else {
            if ($code) {
                //注册
                $code_find = db('password')->where('code', $code)->find();
                if ($code_find) {
                    if ($code_find['user_status']) {
                        $result = [
                            'status' => 0,
                            'data' => '激活码已激活'
                        ];
                        return json_encode($result);
                    }
                    if (strtotime($code_find['pastdue_time']) < time()) {
                        $result = [
                            'status' => 0,
                            'data' => '激活码已失效'
                        ];
                        return json_encode($result);
                    }
                    //激活码可以使用, 使用后更改激活码激活状态
                    $code_find['user_status'] = 1;
                    $data['username'] = $name;
                    $pwd_md5 = md5($pwd . Config::get('salt'));
                    $data['password'] = $pwd_md5;
                    $data['create_time'] = date('Y-m-d H:i:s');
                    $data['password_code'] = $code;
                    if (db('user')->insert($data) !== false && db('password')->where('code', $code)->update(['user_status' => 1]) !== false) {
                        $result = [
                            'status' => 1,
                            'data' => '注册成功, 激活成功'
                        ];
                        return json_encode($result);
                    } else {
                        $result = [
                            'status' => 0,
                            'data' => '注册失败, 激活失败'
                        ];
                        return json_encode($result);
                    }
                } else {
                    $result = [
                        'status' => 0,
                        'data' => '激活码不存在'
                    ];
                    return json_encode($result);
                }
            } else {
                $result = [
                    'status' => 0,
                    'data' => '用户不存在, 请填写激活码激活此用户!'
                ];
                return json_encode($result);
            }
        }
    }

    public function isRepeatLogin($name = '', $mac = '') {
        $user = db('user')->where('username', $name)->find();
        if ($user['last_login_ip'] != $mac) {
            $result = [
                'status' => 0,
                'data' => '该账户在异地登录,请重新登录!'
            ];
            return json_encode($result);
        }
        $result = [
            'status' => 1,
            'data' => '该账户登录正常'
        ];
        return json_encode($result);
    }
}
