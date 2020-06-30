// 基类,接收参数
class Vue {
    constructor(options) {
        this.$el = options.el;
        this.$data = options.data;
        //判断根元素是否存在，存在编译模板
        if (this.$el) {
            new Compiler(this.$el, this);//编译
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
            CompilerUtil['text'](node,content,this.vm)
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
    model(node, expr, vm) {
        let value = this.getValue(vm, expr)
        let fn = this.updater['modelUpdater']
        fn(node, value)
    },
    html() {
        
    },
    text(node,expr,vm){
        let fn = this.updater['textUpdater']
        let content = expr.replace(/\{\{(.+?)\}\}/g,(...args)=>{
            return this.getValue(vm,args[1])
        })
        fn(node,content)
    },
    updater: {
        //把数据插入节点
        modelUpdater(node, value) {
            node.value = value
        },
        htmlUpdater() {

        },
        textUpdater(node,value){
            node.textContent = value
        }
    }
}