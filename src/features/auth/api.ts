type LoginValues = {
  username: string
  password: string
}

export async function loginWithFlask(values: LoginValues) {
  const response = await fetch('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: values.username,
      password: values.password,
    }),
  })

  const data = await response.json()

  if (
    !response.ok ||
    typeof data.access_token !== 'string' ||
    typeof data.refresh_token !== 'string'
  ) {
    throw new Error(data.message || 'Login failed')
  }

  return {
    username: values.username,
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
  }
}