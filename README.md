# applan

Run your dev server and get a friendly, LAN-visible URL instead of an IP
address:

```
$ applan -- npm run dev
...your dev server's normal output...

➜  applan:  http://gavipuram.local:5174   (visible to devices on this WiFi)
```

Open that URL on the same computer, or from your phone/tablet/another
computer on the same WiFi — no IP address to look up, no port to remember
differently each time.

## Install

```
npm install --save-dev applan
```

or run it ad hoc without installing:

```
npx applan -- npm run dev
```

## Usage

```
applan -- <your normal dev command>
applan <your normal dev command>          # "--" is optional if unambiguous
```

Examples:

```
applan -- npm run dev
applan -- vite --host
applan -- next dev
applan --name myapp -- npm run dev    # override the auto-detected name
```

`applan` runs your command exactly as you normally would — output, colors,
exit codes are all passed through unchanged — and additionally:

1. Figures out an app name from the `name` field in the nearest
   `package.json`, or the current folder name if there isn't one — or use
   `--name`/`-n` to set it explicitly.
2. Watches the command's output for the port it started on (recognizes the
   `Local: http://localhost:PORT` banner printed by Vite, Create React App,
   Next.js, Astro, SvelteKit, and most plain Node servers).
3. Advertises `<appname>.local` on your local network via mDNS
   (Bonjour/Zeroconf) pointing at that port, for as long as the command
   keeps running.
4. Withdraws the advertisement the moment the command exits (including
   Ctrl+C) — nothing is left behind.

### A note on Vite (and similar) host checks

Some dev servers reject requests for hostnames they don't recognize, as a
DNS-rebinding protection. If you see `Blocked request. This host is not
allowed`, add the printed hostname to your dev server's allow-list, e.g. in
`vite.config.js`:

```js
export default {
  server: {
    allowedHosts: ["yourapp.local"],
  },
};
```

## Design / security

This package is intentionally minimal-privilege:

- **No sudo/admin required, ever.** It never binds a privileged port and
  never asks for elevation.
- **Nothing persists.** No background daemon, no config/state files, no
  startup entries, no hosts-file edits. The mDNS advertisement exists only
  for the lifetime of the process you ran it with.
- **One runtime dependency**: [`bonjour-service`](https://www.npmjs.com/package/bonjour-service)
  for mDNS, plus [`cross-spawn`](https://www.npmjs.com/package/cross-spawn)
  to correctly and safely run `.cmd`/shell-shim commands (like `npm`) on
  Windows without Node's discouraged `shell: true` pattern.
- **Hostname input is sanitized** before it ever reaches the mDNS
  advertisement (lowercased, restricted to `[a-z0-9-]`, capped at 63
  chars) — arbitrary characters in a `package.json` name or folder name
  can't inject anything into the network advertisement.
- **mDNS is inherently visible on your LAN.** Advertising `<appname>.local`
  means any device on the same WiFi/network segment can see that name and
  connect to that port — this is how `.local` discovery works everywhere
  (AirPlay, printers, Chromecasts, etc.), not a hidden behavior of this
  tool. Don't use it to advertise something you don't want discoverable on
  a shared or untrusted network.

The `.local` suffix itself isn't configurable — that's a hard requirement
of mDNS (RFC 6762), not a missing feature. Browsers and OSes only send
multicast discovery queries for `.local` names; a different suffix like
`appname.dev` would need a real DNS record somewhere, which this
zero-privilege, nothing-persisted tool deliberately doesn't create. `--name`
controls the part before `.local`.

There is no "drop the port entirely" mode (e.g. plain `http://appname.local`
with no port). That would require binding port 80/443, which needs elevated
privileges on most platforms and a persistent background process — a much
bigger trust footprint than this tool asks for. Not planned for this
package.

## Optional: keep typing `npm run dev`

`applan` itself never modifies your shell or global `npm` command — that
would be too invasive for a package other people install. If you want your
own muscle-memory `npm run dev` to transparently go through `applan`, that's
a personal shell tweak you can add yourself, for example in PowerShell
(`$PROFILE`):

```powershell
function npm {
    if ($args[0] -eq 'run' -and $args[1] -eq 'dev') {
        npx applan -- npm @args
    } else {
        npm.cmd @args
    }
}
```

This is entirely optional and lives in your own dotfiles, not in this
package.

## License

MIT
