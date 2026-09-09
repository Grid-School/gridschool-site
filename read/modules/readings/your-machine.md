# Your machine, ready

Everything in this program runs on your own laptop first. Before the first ticket, before the lesson on reading a system, the toolchain has to be on the machine and proven with output you can paste. This is that list. Do it once, top to bottom, on the machine you will actually use.

Sixteen gigabytes of RAM or more. Eight works for the server alone; the moment Docker, an editor, a browser with the world open and an agent run share the machine, eight swaps and you spend the week waiting. If you are at eight, say so in Discord before day one and we will plan around it.

## What you install, and why each one

| Tool | Why it is here |
|---|---|
| Git | Every change travels as a branch and a pull request. |
| A GitHub account with an SSH key | The world's repos live there; a key means no password prompts in a script. |
| .NET 8 SDK | The world server is C#. You build and run it locally in week one. |
| Docker Desktop (or Docker Engine on Linux) | Production runs the server in a container. You run it the same way. |
| Node.js LTS | The web client, the graph tool you will build, and most scripts. |
| Python 3.11 or newer | The delegation script and the notebook tooling. |
| An editor with a built-in terminal | VS Code, Cursor, or anything you already know. Not negotiable: you must be at ease in a terminal by the end of this page. |
| Discord, desktop app | Reviews are asked for in #asks, ships posted in #ship, and this is where you say "I am in stage, anyone around?" |

## macOS

1. Open Terminal. Run `xcode-select --install` and accept. That gives you Git and the compilers.
2. Install [Homebrew](https://brew.sh). Then: `brew install node python@3.12` and `brew install --cask docker`.
3. Install the .NET 8 SDK from [dot.net](https://dotnet.microsoft.com/download/dotnet/8.0). Pick the Arm64 build on Apple silicon, x64 on Intel. Open a new terminal afterwards.
4. Start Docker Desktop once from Applications so it finishes its first-run setup.

## Windows

Use WSL2. The server, Docker and every script in this program are written for a Unix shell, and WSL2 gives you a real Ubuntu on Windows with no dual boot.

1. In PowerShell as administrator: `wsl --install`. Reboot. Open the Ubuntu app it created and set a username.
2. Install Docker Desktop for Windows and, in its settings, turn on the WSL2 integration for Ubuntu.
3. Inside Ubuntu: `sudo apt update && sudo apt install -y git build-essential python3 python3-venv`.
4. Node: install [nvm](https://github.com/nvm-sh/nvm) inside Ubuntu, then `nvm install --lts`.
5. .NET 8 inside Ubuntu: follow Microsoft's Ubuntu instructions for the SDK, or `sudo apt install -y dotnet-sdk-8.0` on 22.04 and newer.
6. Your editor runs on Windows and opens folders inside WSL (VS Code: the WSL extension; Cursor: the same). Keep your repos under the Ubuntu home, not under `/mnt/c`, or Git and Docker will crawl.

## Linux

You already have a shell. Install `git`, `build-essential`, `python3`, `python3-venv`, Node LTS via nvm, the .NET 8 SDK from your distribution or Microsoft's package feed, and Docker Engine with your user in the `docker` group. Log out and in after the group change.

## SSH to GitHub

```sh
ssh-keygen -t ed25519 -C "you@example.com"
cat ~/.ssh/id_ed25519.pub
```

Paste the public key at GitHub → Settings → SSH and GPG keys. Then `ssh -T git@github.com` must greet you by username.

## Prove it

Run these in one terminal and paste the whole block, unedited, into a public gist. Every line must print a version.

```sh
uname -a
git --version
dotnet --version
docker --version && docker run --rm hello-world | head -3
node --version
python3 --version
ssh -T git@github.com
```

The gist is the link for this step. If a line fails, the error is the first thing to fix, and #asks is where to paste it if thirty honest minutes did not solve it.

## The room

Join the Discord from your profile sheet (the avatar at the bottom of the rail). In #asks, post one line: your OS, your RAM, and the gist link. That message is how the cohort knows what you are running when they help you, and it is the second thing this step asks for.

Two channels matter this week. #asks is for anything that blocks you; name what you tried. #ship is where a Friday URL goes. The world itself is one click away on the rail; stage is the default and the place to meet.
