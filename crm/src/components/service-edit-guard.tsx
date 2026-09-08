"use client";
import { useEffect } from "react";
export function ServiceEditGuard() {
    useEffect(() => {
        const dirty = () => Boolean(document.querySelector('[data-service-dirty="true"]'));
        const confirmLeave = () => !dirty() || window.confirm("服务清单仍有未保存的行。确定放弃这些输入并离开？取消可继续编辑和保存。");
        const click = (event: MouseEvent) => {
            if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0)
                return;
            const target = event.target instanceof Element ? event.target.closest('a,[role="tab"]') : null;
            if (!target || (target instanceof HTMLAnchorElement && (target.target === '_blank' || target.hasAttribute('download'))))
                return;
            if (!confirmLeave()) {
                event.preventDefault();
                event.stopPropagation();
            }
        };
        const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty()) {
            event.preventDefault();
            event.returnValue = '';
        } };
        let armed = false, approved = false;
        const url = location.href, state = history.state;
        const arm = () => { if (dirty() && !armed) {
            history.pushState({ ...state, crmServiceGuard: true }, '', url);
            armed = true;
        } };
        const observer = new MutationObserver(arm);
        observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-service-dirty'] });
        const navigate = (event: PopStateEvent) => {
            if (!armed || approved)
                return;
            event.stopImmediatePropagation();
            if (!dirty()) {
                approved = true;
                history.back();
                return;
            }
            history.pushState({ ...state, crmServiceGuard: true }, '', url);
            if (confirmLeave()) {
                approved = true;
                history.go(-2);
            }
        };
        document.addEventListener('click', click, true);
        window.addEventListener('beforeunload', beforeUnload);
        window.addEventListener('popstate', navigate, true);
        return () => { observer.disconnect(); document.removeEventListener('click', click, true); window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('popstate', navigate, true); };
    }, []);
    return null;
}
