# 20 · Delivery pipelines, environments, and where to host

*Series: disciplines. Learn how pipeline stages block unsafe changes, compare hosting models, and write a host decision. About 12 minutes.*

## A pipeline blocks a failed stage

Continuous integration and continuous delivery, or CI/CD, is a sequence of checks that runs when you push code. A build step confirms that the code compiles or bundles. A test step runs the suite, including the contract check from the previous reading. Include linting or formatting only when the result is deterministic. A deploy step publishes the result from a named branch to a URL a stranger can open. Branch protection and pull-request checks require the shared branch to pass these stages. A process that allows unchecked pushes to `main` does not provide that pipeline protection.

## Environments, and the honest version of having one

Use a development environment for changes, a staging environment for tests with production-shaped data, and production for users. A student project usually has one environment. State that fact in the decision memo and explain what a staging environment would have caught. If deployment currently means copying files by hand, document every step and then automate the process in the pipeline. A container packages the program and its runtime instructions. For this program, an explained Dockerfile and an image that starts successfully are sufficient.

## Where to host, and why buying the package is allowed

The four kinds of host are worth telling apart because each one moves a different cost onto you.

| Kind | Examples | When you pick it | What it costs you |
|---|---|---|---|
| Platform as a service | Vercel, Railway, Fly, Render | You want a URL and a log while the platform operates the machine | Vendor limits, cold starts, and capabilities the platform may omit |
| Managed data or auth | Supabase, Firebase, PlanetScale, Clerk | You want the vendor to operate a database or authentication service | Lock-in, billing surprises, and an abstraction that may expose its underlying limits |
| Infrastructure as a service | AWS, Azure, GCP virtual machines | You need the box, the network, or a compliance story | You are now on call for the machine |
| Your own small server | Lightsail, a small virtual server you patch | The world already does this and you understand what it costs | You patch it, back it up, and watch it |

You may use a packaged service. Choose a host for the project’s goal, explain why it won, name two rejected alternatives, and identify the billing or capacity unit you will watch. **Infrastructure as code** means files in the repository can recreate the host. A Terraform module, Pulumi program, or Compose file qualifies when a stranger can use it to start the system. Domain Name System, or DNS, connects a domain name to the host. Transport Layer Security, or TLS, protects traffic at an HTTPS URL. Shipping requires a public HTTPS URL that works from another computer.

## The memo is the grade

Reading 23 asks for a complete technology decision for your chosen project. In this reading, decide only where to host an existing starter. Name the platform you would choose, two rejected platforms and why they lost, and the condition that would make you move. Those details turn a preference into a decision another person can review.

## The starter pipeline for this reading

The world server already has a pipeline. On pull request and on push to `main` it restores, builds, tests, and builds a Docker image. A second workflow deploys to Lightsail staging when the AWS secrets exist, and exits green with a notice when they do not. The public URL that workflow is aiming at is `https://play.gridschool.org` for the client on CloudFront, with the socket on the Lightsail box.

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

Explain each stage in the starter pipeline shown above.

## Do this now (60 minutes)

In the first task field, name every stage in the starter pipeline and state the condition that would make each stage fail. In the host-decision field, name the host you would choose for the toy shop from reading 15, two rejected hosts, and the condition that would make you switch.

Write the memo about the provided starter because you have not chosen a project system yet.

## Done when

the pipeline field names every stage and its failure condition, and the host-decision field names the toy shop host, two rejected alternatives, and the condition that would make you switch.

## What's next

21 · Observability and incidents: a staged incident on the world's lying health endpoint, reported from signals you are given.
