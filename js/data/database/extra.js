// For now: To test loading screen popup

export async function loading_notif() {
    // for now just return. later check supabase for notif
    return [
        false, 
        'Updating', 
        'We are currently updating. Due to that you cannot play currently. We are sorry for the unconvenience', 
        'Estimated end: 18:55', 
        'assets/images/home-screen/icons/placeholder.png'
    ];  //so notification is enabled
}