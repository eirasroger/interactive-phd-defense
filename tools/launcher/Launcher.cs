// Offline launcher: serves app/ on loopback and opens it in a browser app window.
// Written in C# 5 so both csc.exe and PowerShell Add-Type can compile it.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;

public static class DefenseLauncher
{
    const int PreferredPort = 4180;
    const int IdleTimeoutMs = 30000;

    static readonly Dictionary<string, string> ContentTypes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { ".html", "text/html; charset=utf-8" },
            { ".js", "text/javascript; charset=utf-8" },
            { ".mjs", "text/javascript; charset=utf-8" },
            { ".css", "text/css; charset=utf-8" },
            { ".json", "application/json" },
            { ".svg", "image/svg+xml" },
            { ".png", "image/png" },
            { ".jpg", "image/jpeg" },
            { ".jpeg", "image/jpeg" },
            { ".webp", "image/webp" },
            { ".ico", "image/x-icon" },
            { ".wasm", "application/wasm" },
            { ".glb", "model/gltf-binary" },
            { ".gltf", "model/gltf+json" },
            { ".woff2", "font/woff2" },
            { ".woff", "font/woff" },
        };

    static string root;

    public static void Main(string[] args)
    {
        root = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app");
        string query = "";
        bool openBrowser = true;

        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--root" && i + 1 < args.Length) root = args[++i];
            else if (args[i] == "--safe") query = "?safe=1";
            else if (args[i] == "--no-browser") openBrowser = false;
        }

        root = Path.GetFullPath(root).TrimEnd('\\') + "\\";
        if (!File.Exists(root + "index.html"))
        {
            Fail("Cannot find " + root + "index.html. Keep the app folder next to the launcher.");
            return;
        }

        TcpListener listener;
        try
        {
            listener = Listen(PreferredPort);
        }
        catch (SocketException)
        {
            listener = Listen(0);
        }

        int port = ((IPEndPoint)listener.LocalEndpoint).Port;
        string url = "http://127.0.0.1:" + port + "/" + query;

        Console.Title = "PhD Defense";
        Console.WriteLine();
        Console.WriteLine("  PhD Defense is running at " + url);
        Console.WriteLine();
        Console.WriteLine("  Keep this window open while presenting. Close it to stop.");
        Console.WriteLine();

        if (openBrowser) OpenBrowser(url);

        while (true)
        {
            TcpClient client = listener.AcceptTcpClient();
            ThreadPool.QueueUserWorkItem(Serve, client);
        }
    }

    static TcpListener Listen(int port)
    {
        TcpListener listener = new TcpListener(IPAddress.Loopback, port);
        listener.Start();
        return listener;
    }

    static void OpenBrowser(string url)
    {
        string browser = FindBrowser();
        if (browser == null)
        {
            Console.WriteLine("  Chrome and Edge were not found. Opening the default browser.");
            Process.Start(url);
            return;
        }

        string profile = Path.Combine(Path.GetTempPath(), "phd-defense-browser");
        string arguments =
            "--app=\"" + url + "\"" +
            " --user-data-dir=\"" + profile + "\"" +
            " --no-first-run --no-default-browser-check --start-maximized" +
            " --force_high_performance_gpu";
        Process.Start(browser, arguments);
    }

    static string FindBrowser()
    {
        string[][] candidates =
        {
            new[] { "ProgramFiles", @"Google\Chrome\Application\chrome.exe" },
            new[] { "ProgramFiles(x86)", @"Google\Chrome\Application\chrome.exe" },
            new[] { "LocalAppData", @"Google\Chrome\Application\chrome.exe" },
            new[] { "ProgramFiles(x86)", @"Microsoft\Edge\Application\msedge.exe" },
            new[] { "ProgramFiles", @"Microsoft\Edge\Application\msedge.exe" },
        };

        foreach (string[] candidate in candidates)
        {
            string folder = Environment.GetEnvironmentVariable(candidate[0]);
            if (string.IsNullOrEmpty(folder)) continue;
            string path = Path.Combine(folder, candidate[1]);
            if (File.Exists(path)) return path;
        }
        return null;
    }

    static void Serve(object state)
    {
        TcpClient client = (TcpClient)state;
        try
        {
            client.NoDelay = true;
            client.ReceiveTimeout = IdleTimeoutMs;
            NetworkStream stream = client.GetStream();
            StreamReader reader = new StreamReader(stream, Encoding.ASCII);

            while (true)
            {
                string requestLine = reader.ReadLine();
                if (string.IsNullOrEmpty(requestLine)) break;

                bool keepAlive = true;
                string header;
                while (!string.IsNullOrEmpty(header = reader.ReadLine()))
                {
                    if (header.StartsWith("Connection:", StringComparison.OrdinalIgnoreCase) &&
                        header.IndexOf("close", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        keepAlive = false;
                    }
                }

                Respond(stream, requestLine, keepAlive);
                if (!keepAlive) break;
            }
        }
        catch (IOException) { }
        catch (ObjectDisposedException) { }
        finally
        {
            client.Close();
        }
    }

    static void Respond(Stream stream, string requestLine, bool keepAlive)
    {
        string[] parts = requestLine.Split(' ');
        if (parts.Length < 3)
        {
            WriteStatus(stream, "400 Bad Request", keepAlive);
            return;
        }

        string method = parts[0];
        if (method != "GET" && method != "HEAD")
        {
            WriteStatus(stream, "405 Method Not Allowed", keepAlive);
            return;
        }

        string file = Resolve(parts[1]);
        if (file == null)
        {
            Console.WriteLine("  Not found: " + parts[1]);
            WriteStatus(stream, "404 Not Found", keepAlive);
            return;
        }

        string contentType;
        if (!ContentTypes.TryGetValue(Path.GetExtension(file), out contentType))
        {
            contentType = "application/octet-stream";
        }

        using (FileStream body = File.OpenRead(file))
        {
            WriteHead(stream, "200 OK", contentType, body.Length, keepAlive);
            if (method == "GET") body.CopyTo(stream, 81920);
        }
        stream.Flush();
    }

    static string Resolve(string target)
    {
        int cut = target.IndexOfAny(new[] { '?', '#' });
        if (cut >= 0) target = target.Substring(0, cut);

        try
        {
            string path = Uri.UnescapeDataString(target);
            if (path.EndsWith("/")) path += "index.html";
            string file = Path.GetFullPath(root + path.TrimStart('/').Replace('/', '\\'));
            bool inside = file.StartsWith(root, StringComparison.OrdinalIgnoreCase);
            return inside && File.Exists(file) ? file : null;
        }
        catch (ArgumentException) { return null; }
        catch (NotSupportedException) { return null; }
        catch (PathTooLongException) { return null; }
    }

    static void WriteStatus(Stream stream, string status, bool keepAlive)
    {
        byte[] body = Encoding.ASCII.GetBytes(status);
        WriteHead(stream, status, "text/plain", body.Length, keepAlive);
        stream.Write(body, 0, body.Length);
        stream.Flush();
    }

    static void WriteHead(Stream stream, string status, string contentType, long length, bool keepAlive)
    {
        string head =
            "HTTP/1.1 " + status + "\r\n" +
            "Content-Type: " + contentType + "\r\n" +
            "Content-Length: " + length + "\r\n" +
            "Cache-Control: no-cache\r\n" +
            "Connection: " + (keepAlive ? "keep-alive" : "close") + "\r\n\r\n";
        byte[] bytes = Encoding.ASCII.GetBytes(head);
        stream.Write(bytes, 0, bytes.Length);
    }

    static void Fail(string message)
    {
        Console.WriteLine();
        Console.WriteLine("  " + message);
        Console.WriteLine();
        Console.WriteLine("  Press any key to close.");
        Console.ReadKey(true);
    }
}
