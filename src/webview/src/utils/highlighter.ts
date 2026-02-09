/**
 * 极简语法高亮器
 * 为 Webview 中的代码块提供基础的着色功能
 */

export interface Token {
    type: string;
    content: string;
}

const RULES: Record<string, Array<{ type: string; regex: RegExp }>> = {
    // 通用规则 (适用于大多数类 C 语言)
    common: [
        { type: 'comment', regex: /\/\/.*|\/\*[\s\S]*?\*\// },
        { type: 'string', regex: /(["'])(?:(?=(\\?))\2.)*?\1/ },
        { type: 'keyword', regex: /\b(break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|false|finally|for|function|if|import|in|instanceof|new|null|return|super|switch|this|throw|true|try|typeof|var|void|while|with|yield|async|await|let|static|interface|type|public|private|protected|readonly|get|set|from|as|namespace|any|number|string|boolean|void|never|unknown)\b/ },
        { type: 'number', regex: /\b\d+(\.\d+)?\b/ },
        { type: 'operator', regex: /[+\-*/%=<>!&|^~?:]+/ },
        { type: 'punctuation', regex: /[()[\]{}.,;]+/ },
    ],
    // Python
    py: [
        { type: 'comment', regex: /#.*/ },
        { type: 'string', regex: /(["'])(?:(?=(\\?))\2.)*?\1|"""[\s\S]*?"""|'''[\s\S]*?'''/ },
        { type: 'keyword', regex: /\b(False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b/ },
        { type: 'number', regex: /\b\d+(\.\d+)?\b/ },
    ],
    // HTML/XML
    html: [
        { type: 'comment', regex: /<!--[\s\S]*?-->/ },
        { type: 'tag', regex: /<[^>]+>/ },
        { type: 'keyword', regex: /&[a-z0-9]+;/i },
    ],
    // CSS
    css: [
        { type: 'comment', regex: /\/\*[\s\S]*?\*\// },
        { type: 'keyword', regex: /@[a-z-]+/i },
        { type: 'operator', regex: /[:;{}]+/ },
        { type: 'number', regex: /\b\d+(\.\d+)?(px|em|rem|vh|vw|%)?\b/ },
        { type: 'string', regex: /(["'])(?:(?=(\\?))\2.)*?\1/ },
    ]
};

/**
 * 根据文件名获取语言规则
 */
function getLanguageRules(fileName: string) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'py': return RULES.py;
        case 'html':
        case 'xml':
        case 'vue': return RULES.html;
        case 'css':
        case 'scss':
        case 'less': return RULES.css;
        default: return RULES.common;
    }
}

/**
 * 对代码行进行着色处理
 */
export function highlight(code: string, fileName: string): string {
    if (!code) return '';
    
    const rules = getLanguageRules(fileName);
    let html = '';
    let pos = 0;

    while (pos < code.length) {
        let match = null;
        let bestRule = null;

        for (const rule of rules) {
            rule.regex.lastIndex = pos;
            const m = rule.regex.exec(code.slice(pos));
            if (m && m.index === 0) {
                if (!match || m[0].length > match[0].length) {
                    match = m;
                    bestRule = rule;
                }
            }
        }

        if (match && bestRule) {
            const content = match[0];
            html += `<span class="token-${bestRule.type}">${escapeHtml(content)}</span>`;
            pos += content.length;
        } else {
            html += escapeHtml(code[pos]);
            pos++;
        }
    }

    return html;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
