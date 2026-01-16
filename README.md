# Setup Ona CLI

A GitHub Action that downloads and configures the [Ona CLI](https://www.gitpod.io/docs/references/gitpod-cli) for use in workflows.

## Usage

```yaml
- uses: ona-io/setup-ona@v1
  with:
    token: ${{ secrets.ONA_TOKEN }}  # optional
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `channel` | Release channel: `stable` or `latest` | No | `stable` |
| `token` | Ona access token for authentication | No | - |

## Examples

### Basic usage (unauthenticated)

```yaml
steps:
  - uses: ona-io/setup-ona@v1
  - run: gitpod --help
```

### With authentication

```yaml
steps:
  - uses: ona-io/setup-ona@v1
    with:
      token: ${{ secrets.ONA_TOKEN }}
  - run: gitpod whoami
  - run: gitpod environment list
```

### Use latest channel

```yaml
steps:
  - uses: ona-io/setup-ona@v1
    with:
      channel: latest
```

### Create an environment from CI

```yaml
steps:
  - uses: ona-io/setup-ona@v1
    with:
      token: ${{ secrets.ONA_TOKEN }}
  - run: gitpod environment create https://github.com/${{ github.repository }}
```

## Supported platforms

- Linux (x64, arm64)
- macOS (x64, arm64)
- Windows (x64, arm64)

## Getting an Ona token

1. Go to [gitpod.io/user/tokens](https://gitpod.io/user/tokens)
2. Create a new access token
3. Add it as a repository secret named `ONA_TOKEN`

## License

MIT
