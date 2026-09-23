# 20 · Delivery pipelines, environments, and where to host

*How pipeline stages block unsafe changes, and how to choose a host. About 11 minutes.*

## One commit to a running server

Martin Fowler's definition of continuous delivery is the ability to put a working build into a production-like environment at any time. The obligation to ship every commit is a different practice, continuous deployment. Continuous delivery is the skill discussed here. A **pipeline** is the sequence that makes the ability real.

**GridGlade** is the shared multiplayer game used as the example here. When a change lands on a GridGlade pull request, the build workflow restores packages, builds the .NET server, runs the tests, and builds a Docker image. If any stage fails, the change stops. If the build passes and the deploy credentials are available as protected AWS secrets, a separate deploy workflow sends the server to **Lightsail**, Amazon's small virtual-server service. If the credentials are missing, the deploy job succeeds with a notice and skips the deployment. The workflow aims to serve the client at `https://play.gridschool.org` through CloudFront, Amazon's content delivery network, while the WebSocket server runs on Lightsail.

Continuous integration and continuous delivery, or CI/CD, is that sequence of checks when you push code. A build step confirms that the code compiles or bundles. A test step runs the suite, including a contract check when needed: an automated comparison between the implemented API and its written API document. Include linting or formatting only when the result is deterministic. A deploy step publishes the result from a named branch to a URL a stranger can open. Branch protection and pull-request checks require the shared branch to pass these stages. A process that allows unchecked pushes to `main` does not provide that pipeline protection.

## Environments, and the honest version of having one

Use a development environment for changes, a staging environment for tests with production-shaped data, and production for users. Many early systems have one environment. State that fact when you describe the host, and explain what a staging environment would have caught. If deployment currently means copying files by hand, document every step and then automate the process in the pipeline. A container packages the program and its runtime instructions. An explained Dockerfile and an image that starts successfully already show that you understand what the container contains.

## Where to host

GridGlade already uses a small server that someone patches and backs up: a Unity WebGL client served through CloudFront, and a WebSocket server on an Amazon Lightsail machine with no database.

The four kinds of host are worth telling apart because each one moves a different cost onto you.

Platform as a service, such as Vercel, Railway, Fly, or Render: you want a URL and a log while the platform operates the machine. You pay in vendor limits, cold starts, and capabilities the platform may omit.

Managed data or auth, such as Supabase, Firebase, PlanetScale, or Clerk: you want the vendor to operate a database or authentication service. You pay in lock-in, billing surprises, and an abstraction that may expose its underlying limits.

Infrastructure as a service, such as AWS, Azure, or GCP virtual machines: you need the box, the network, or a compliance story. You are now on call for the machine.

Your own small server, such as Lightsail or a small virtual server you patch: you understand what a small patched server costs. You patch it, back it up, and watch it.

You may use a packaged service. Choose a host for the project's goal, explain why it won, name two rejected alternatives, and identify the billing or capacity unit you will watch. Monthly cost belongs in that decision because cost is one of the reasons a host later has to be replaced. Infrastructure as code means files in the repository can recreate the host. A Terraform module, Pulumi program, or Compose file qualifies when a stranger can use it to start the system. Domain Name System, or DNS, connects a domain name to the host. Transport Layer Security, or TLS, protects traffic at an HTTPS URL. Shipping requires a public HTTPS URL that works from another computer.

A useful host decision names the platform, two rejected platforms and why they lost, and the condition that would make you move. Those details turn a preference into a choice another person can review.

## The GridGlade pipeline

On pull request and on push to `main` the GridGlade server restores, builds, tests, and builds a Docker image.

```yaml
name: build
on:
  pull_request:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: "8.0.x"
      - name: Restore
        run: dotnet restore
      - name: Build
        run: dotnet build --no-restore -c Release
      - name: Test
        run: dotnet test --no-build -c Release --verbosity normal
      - name: Docker build
        run: docker build -t gridschool-world-server:ci .
```

Restore fails when dependencies cannot be fetched, build fails when the code does not compile, test fails when a check in the suite fails, and the Docker step fails when the image cannot be built. Each stage is useful because it can stop an unsafe change from reaching the next one.

## Shipping should become ordinary

A deployment is most dangerous when it depends on one person's memory. Continuous delivery turns that private sequence into a path the repository can repeat: build the same artifact, run the same checks, move it through known environments, and stop at the same failures.

The host matters because every platform assigns responsibility somewhere. A managed service takes some operations away and adds a vendor boundary. A small server gives you control and makes patching, backups, cost, and recovery your problem. The right choice is the one whose responsibilities you can name and carry.

The purpose of the pipeline is not to make deployment impressive. It is to make a release unsurprising, reversible, and dull enough to do again tomorrow.
