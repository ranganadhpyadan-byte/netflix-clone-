# Lumora

A demo streaming site with its own brand and invented films and series. It is plain HTML, CSS and JavaScript
with no dependencies or build step. All artwork and the animated "video" are generated in the browser.

This is a demo and is not affiliated with any streaming service. Sign-in accepts any email, passwords are not
checked or stored, and everything is saved only in your browser.

## Run it

```bash
python -m http.server 8080
```

Then open http://localhost:8080. Opening `index.html` directly will not work, because the site uses ES modules.

See [SPEC.md](SPEC.md) for how the code is organised.
