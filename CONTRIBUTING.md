# <img src="https://github.com/unbound-mod/assets/blob/main/logo/logo.png?raw=true" style="width: 2rem"> Welcome!

## Welcome to the Unbound contribution guide!

We're so glad you want to contribute! We're sure your contribution will be amazing 💖

<hr />

## Let's set some rules to follow when contributing:

1. Please follow the syntax styles defined by the files you're working in. If you create a PR with inconsistent coding styles (*yes this may mean tabs vs spaces*) you may be asked to change your formatting before your PR is accepted.
2. Please write clear, concise commit messages that describe the changes you've made. This helps reviewers understand your work quickly without needing to decypher your changes.
3. Please test your code. Ensure that it, at the very least, builds. We'll explain how to do this later in this page.
4. Please keep your PR focused. By this, we mean for you not to go into a rabbit hole where you fix 100 other issues, but rather stick to the problem that your changes are supposed to fix.
5. Please stay up to date with the `main` branch. This may mean needing to resolve merge conflicts.
6. Building on point 2, please document the changes you've made. Creating a small message which you update to detail the overall progress of your PR is helpful for reviewers to quickly understand how close your PR is to completion.

<hr />

## How to build Unbound:

### Quick start:

First, make sure you have forked [the repository](https://github.com/unbound-mod/client) so that you have write access.

```console
git clone https://github.com/[YOU]/client --recursive
cd client
pnpm i
pnpm build
```

### Full explanation:

1. Clone the client repository to your local machine:

```console
$ git clone https://github.com/[YOU]/client --recursive
```

(Note `--recursive` to also clone the i18n submodule)

2. Move to the directory you just cloned:

```console
$ cd client
```

If you cloned the repository without installing the submodule, do so now:

```console
$ git submodule init
$ git submodule update --remote --merge
```

3. Install dependencies:

(You may need to run `npm i -g pnpm` first to install `pnpm`)

```console
$ pnpm i
```

4. Build the project:

```console
$ pnpm build
```

If you have `nodemon` installed, you can also just run it:

```console
$ nodemon
```

to automatically rebuild upon changes.

<hr />

## How to deploy the bundle locally:

### Through `python3`:

```console
$ cd dist && python3 -m http.server [PORT]
```

### Through `http-server`:

```console
$ cd dist && http-server -p [PORT]
```

### Through `bun serve`:

```console
$ bun serve [PORT]
```

(Note that here you don't need to `cd dist`. `bun serve` automatically yields files from the `dist` directory)

All of these methods should open a local server on port [PORT] which hosts the files in the `dist` directory.

## How to load the bundle you deployed:

In your existing Unbound installation:

1. Go to `Discord Settings` > `Unbound` > `Developer Settings`
2. Change `Custom Bundle URL` to `http://[LOCAL_IP]:[PORT]/unbound.js`
3. Restart your Discord app

<hr />

## How to contribute to Unbound:

1. Checkout a new branch:

```console
$ git checkout -b feature/xyz
```

This should automatically switch to your new branch. If it didn't, you should switch there manually:

```console
$ git checkout feature/xyz
```

2. Make your changes:

```console
$ git commit -m 'Added a feature! Fixed 39 bugs!'
$ git push
```

3. Create a [pull request](https://github.com/unbound-mod/client/pulls)
4. *You're done! Yay!*

<hr />

## Thank you so much for contributing to Unbound!
<a href="#top">⇡ Back to top️!</a>
