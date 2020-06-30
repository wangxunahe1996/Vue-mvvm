//观察者（发布订阅）
class Watcher {
    constructor(vm, expr, cb) {
        this.vm = vm
        this.expr = expr
        this.cb = cb
        //默认存放一个老值，当值变化时，对比，变化则更新
        this.oldValue = this.get()
    }
    get() {
        Dep.target = this //watcher先把自己放在this上
        //取值，把观察者和数据结合起来
        let value = CompilerUtil.getValue(this.vm, this.expr)
        Dep.target = null
        return value
    }
    update() { //更新操作
        let newValue = CompilerUtil.getValue(this.vm, this.expr)
        if (newValue != this.oldValue) {
            this.cb(newValue) //回调函数
        }
    }
}
//订阅发布
class Dep {
    constructor() {
        this.subs = [] //存放所有的观察者
    }
    //订阅
    addSub(watcher) {//添加所有的watcher
        this.subs.push(watcher)
    }
    //发布
    notify() {
        this.subs.forEach(watcher => {
            watcher.update()
        })
    }
}
//数据劫持
class Observer {
    constructor(data) {
        this.observer(data)
    }
    observer(data) {
        if (data && typeof data == 'object') {
            //判断data合法性,如果是对象才观察，如果是对象
            for (let key in data) {
                this.defineReactive(data, key, data[key])
            }
        }
    }
    defineReactive(obj, key, value) {
        this.observer(value) //如果值也是对象，递归劫持
        let dep = new Dep() //给每个属性都加入发布订阅的功能
        Object.defineProperty(obj, key, {
            get() {
                //创建watcher时取到对应的内容，并且把watcher放到全局上。
                Dep.target && dep.addSub(Dep.target)
                return value
            },
            set: (newValue) => {
                if (newValue != value) {
                    this.observer(newValue) //赋值的也是对象的话 ，也要劫持
                    value = newValue
                    dep.notify()
                }
            }
        })
    }
}
// 基类,接收参数
class Vue {
    constructor(options) {
        this.$el = options.el;
        this.$data = options.data;
        //判断根元素是否存在，存在编译模板
        if (this.$el) {
            //将数据全部转化为object.defineProperty来定义
            new Observer(this.$data) //新增
            //把数据获取操作，vm上的取值操作，都代理到vm.$data
            this.proxyVm(this.$data)
            new Compiler(this.$el, this);//编译
        }
    }
    proxyVm(data){
        for(let key in data){
            Object.defineProperty(this,key,{
                get(){
                    return data[key]//进行转化
                }
            })
        }
    }
}
//编译类
class Compiler {
    constructor(el, vm) {
        //判断el是否是一个元素，如果不是元素，获取元素
        this.el = this.isElementNode(el) ? el : document.querySelector(el)
        //此时拿到当前的模板，替换，替换的时候放在内存中，在内存中替换之后，添加到页面中，如果拿到一次替换一次，会不断触发浏览器回流
        //放到内存中
        this.vm = vm
        let fragment = this.node2fragment(this.el)
        //把节点内容替换
        //用数据编译模板,用 vm中的data
        this.compile(fragment)
        //把节点内容添加到页面中
        this.el.appendChild(fragment)

    }
    isElementNode(node) { //判断是否是元素的方法

        return node.nodeType === 1;
    }
    //把节点移动到内存中
    node2fragment(node) {
        let fragement = document.createDocumentFragment() //创建文档碎片
        let firstChild
        while (firstChild = node.firstChild) {
            fragement.appendChild(firstChild)
        }
        return fragement
    }
    // 核心编译方法
    compile(node) {
        let childNodes = node.childNodes
        //拿到子节点之后判断是否是元素，伪数组转数组
        let childNodesArr = [...childNodes]
        childNodesArr.forEach(child => {
            if (this.isElementNode(child)) {
                this.compileElement(child) //编译元素的，v-开头
                //因为只拿到了第一次，所以需要把自己传进去，判断子节点
                this.compile(child) //递归
            } else {
                this.compileText(child) //编译文本的 ，{{}}
            }
        })
    }
    // 编译元素
    compileElement(node) {
        let attributes = node.attributes //类数组
        let attributesArr = [...attributes] //转数组
        attributesArr.forEach(attr => { //attr 格式 name=value 找到元素
            let { name, value: expr } = attr
            if (this.isDirective(name)) {
                let [, directiveName] = name.split('-')
                CompilerUtil[directiveName](node, expr, this.vm) //调用工具类 指令有很多，所以写一个工具类，用来处理不同指令
            }
        })
    }
    // 编译文本
    compileText(node) {
        let content = node.textContent
        if (/\{\{(.+?)\}\}/.test(content)) { //找到文本 {{author.name}}等
            CompilerUtil['text'](node, content, this.vm)
        }
    }
    //判断是不是v-开头的方法
    isDirective(name) {
        return name.startsWith('v-')
    }
}
//编译工具
CompilerUtil = {
    getValue(vm, expr) { //根据表达式获取数据
        return expr.split('.').reduce((data, current) => {
            return data[current]
        }, vm.$data)
    },
    setValue(vm, expr, val) { //输入值，试图更新
        expr.split('.').reduce((data, current, index, arr) => {
            if (index == arr.length - 1) {
                data[current] = val
            }
            return data[current]
        }, vm.$data)
    },
    getContentValue(vm, expr) {
        //遍历表达式，将内容重新替换成一个完整的内容
        return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
            return this.getValue(vm, args[1])
        })
    },
    // 解析v-model
    model(node, expr, vm) {
        let value = this.getValue(vm, expr)
        let fn = this.updater['modelUpdater']
        new Watcher(vm, expr, (newValue) => { //给输入框加上观察者，数据更新触发这个方法，给输入框赋新值
            fn(node, newValue)
        })
        node.addEventListener('input', (e) => {
            let val = e.target.value
            this.setValue(vm, expr,val)
        })
        fn(node, value)
    },
    html() {

    },
    text(node, expr, vm) {
        let fn = this.updater['textUpdater']
        let content = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
            //给表达式的每个变量都加上观察者
            new Watcher(vm, args[1], () => {
                fn(node, this.getContentValue(vm, expr)) //返回全的字符串
            })
            return this.getValue(vm, args[1])

        })

        fn(node, content)
    },
    updater: {
        //把数据插入节点
        modelUpdater(node, value) {
            node.value = value
        },
        htmlUpdater() {

        },
        textUpdater(node, value) {
            node.textContent = value
        }
    }
}