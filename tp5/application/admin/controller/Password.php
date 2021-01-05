<?php
namespace app\admin\controller;

use app\common\model\Password as PasswordModel;
use app\common\controller\AdminBase;
use think\Config;
use think\Db;

/**
 * 激活码管理
 * Class AdminPassword
 * @package app\admin\controller
 */
class Password extends AdminBase
{
    protected $password_model;

    protected function _initialize()
    {
        parent::_initialize();
        $this->password_model = new PasswordModel();
    }

    /**
     * 激活码管理
     * @param string $keyword
     * @param int    $page
     * @return mixed
     */
    public function index($keyword = '', $page = 1)
    {
        $map = [];
        if ($keyword) {
            $map['code|id'] = ['like', "%{$keyword}%"];
        }
        $password_list = $this->password_model->where($map)->order('id DESC')->paginate(15, false, ['page' => $page]);

        return $this->fetch('index', ['password_list' => $password_list, 'keyword' => $keyword]);
    }

    /**
     * 添加激活码
     * @return mixed
     */
    public function add()
    {
        $this->save();
    }

    /**
     * 保存激活码
     */
    public function save()
    {
        $randpwd = '';
        for ($i = 0; $i < 10; $i++) {
            $randpwd .= chr(mt_rand(33, 126));
        }
        $code = $randpwd .= time();
        $data['code'] = md5($code . Config::get('salt'));
        $data['pastdue_time'] = date("Y-m-d H:i:s", time()+60*60*24*365);
        if ($this->password_model->allowField(true)->save($data)) {
            $this->success('添加成功');
        } else {
            $this->error('添加失败');
        }
    }

    /**
     * 编辑激活码
     * @param $id
     * @return mixed
     */
    public function edit($id)
    {
        $password = $this->password_model->find($id);
        return $this->fetch('edit', ['password' => $password]);
    }

    /**
     * 更新激活码
     * @param $id
     */
    public function update($id)
    {
        if ($this->request->isPost()) {
            $data               = $this->request->post();
            $password           = $this->password_model->find($id);
            $password->id       = $id;
            $password->status   = $data['status'];
            $password->pastdue_time   = $data['pastdue_time'];
            if ($password->save() !== false) {
                $this->success('更新成功');
            } else {
                $this->error('更新失败');
            }
        }
    }

    /**
     * 删除激活码
     * @param $id
     */
    public function delete($id)
    {
        if ($this->password_model->destroy($id)) {
            $this->success('删除成功');
        } else {
            $this->error('删除失败');
        }
    }
}