(() => {
    const key = "qtp-ui-version-v1";
    let version = "classic";
    try {
        const selected = window.localStorage.getItem(key);
        version = ["classic", "current", "v2"].includes(selected) ? selected : "classic";
    }
    catch {
        version = "classic";
    }
    window.location.replace(`/${version}/`);
})();
