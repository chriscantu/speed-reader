import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        guard let item = context.inputItems.first as? NSExtensionItem else {
            os_log(.error, "[SpeedReader] No input items in extension context")
            context.completeRequest(returningItems: [], completionHandler: nil)
            return
        }

        let message = item.userInfo?[SFExtensionMessageKey]
        os_log(.default, "[SpeedReader] Received message: %{public}@",
               String(describing: message))

        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: ["Response to": message as Any]]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}
