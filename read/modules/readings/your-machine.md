# Your machine, ready

You will first run every part of this program on your own laptop. Before you begin the first ticket or the system-reading lesson, install the toolchain and produce output that proves each tool works. Follow this list from top to bottom on the laptop you will use for the program.

Use a laptop with at least sixteen gigabytes of RAM. Eight gigabytes can run the server alone, but the operating system will begin swapping memory to disk when Docker, an editor, a browser with the world open, and an agent run at the same time. If your laptop has eight gigabytes, include that amount in the machine sentence you post in the Asks channel.

## What you install, and why each one

| Tool | Why it is here |
|---|---|
| Git | Every change travels as a branch and a pull request. |
| A GitHub account with an SSH key | The world’s repositories live there. An SSH key lets scripts connect automatically. |
| .NET 8 SDK | The world server is C#. You build and run it locally in week one. |
| Docker Desktop (or Docker Engine on Linux) | Production runs the server in a container. You run it the same way. |
| Node.js LTS | The web client, the graph tool you will build, and most scripts. |
| Python 3.11 or newer | The delegation script and the notebook tooling. |
| An editor with a built-in terminal | Use VS Code, Cursor, or another editor you already know. By the end of this page, you must be comfortable running commands in its terminal. |
| Discord desktop app | Ask for reviews in the Asks channel, post shipped work in the Ship channel, and use Discord to tell the cohort when you are in Stage. |

## macOS

1. Open Terminal. Run `xcode-select --install` and accept. That gives you Git and the compilers.
2. Install [Homebrew](https://brew.sh). Then: `brew install node python@3.12` and `brew install --cask docker`.
3. Install the .NET 8 SDK from [dot.net](https://dotnet.microsoft.com/download/dotnet/8.0). Pick the Arm64 build on Apple silicon, x64 on Intel. Open a new terminal afterwards.
4. Start Docker Desktop once from Applications so it finishes its first-run setup.

## Windows

Use Windows Subsystem for Linux 2, or WSL2. The server, Docker, and every program script expect a Unix shell. WSL2 provides Ubuntu within Windows.

1. In PowerShell as administrator: `wsl --install`. Reboot. Open the Ubuntu app it created and set a username.
2. Install Docker Desktop for Windows and, in its settings, turn on the WSL2 integration for Ubuntu.
3. Inside Ubuntu: `sudo apt update && sudo apt install -y git build-essential python3 python3-venv`.
4. Node: install [nvm](https://github.com/nvm-sh/nvm) inside Ubuntu, then `nvm install --lts`.
5. .NET 8 inside Ubuntu: follow Microsoft's Ubuntu instructions for the SDK, or `sudo apt install -y dotnet-sdk-8.0` on 22.04 and newer.
6. Run your editor on Windows and open folders inside WSL. In VS Code or Cursor, use the WSL extension. Keep your repositories under the Ubuntu home directory. Git and Docker run slowly under `/mnt/c`.

## Linux

You already have a shell. Install `git`, `build-essential`, `python3`, `python3-venv`, Node LTS via nvm, the .NET 8 SDK from your distribution or Microsoft's package feed, and Docker Engine with your user in the `docker` group. Log out and in after the group change.

## SSH to GitHub

```sh
ssh-keygen -t ed25519 -C "you@example.com"
cat ~/.ssh/id_ed25519.pub
```

Paste the public key at GitHub → Settings → SSH and GPG keys. Then `ssh -T git@github.com` must greet you by username.

## Prove it

Run these seven commands in one terminal. Every command must print a version or, for the final command, greet you by your GitHub username. Copy the complete output exactly as the terminal printed it.

```sh
uname -a
git --version
dotnet --version
docker --version && docker run --rm hello-world | head -3
node --version
python3 --version
ssh -T git@github.com
```

Return to the Your machine step in GridSchool. Paste the complete terminal output into the field labeled **Paste the unedited terminal output of the seven checks**. If a command fails, spend up to thirty minutes checking the error and the installation instructions. Then post the command, error, and steps you tried in the Asks channel.

## The room

In the **Operating system and memory** field, write one sentence that names your operating system, amount of RAM, and whether all seven checks passed. Post the same sentence in the Asks channel. Paste that sentence into the field labeled **Paste the sentence you posted in the Asks channel**.

Use the Asks channel for blockers and include what you already tried. Post your Friday URL in the Ship channel. Open World from the left-hand menu to enter Stage, where the cohort meets.
