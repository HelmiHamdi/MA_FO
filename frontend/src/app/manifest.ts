import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Matchmaking App',
    short_name: 'MA_FO',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f0ff',
    theme_color: '#4a0e6e',
  }
}